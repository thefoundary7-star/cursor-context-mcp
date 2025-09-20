import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import {
  generateMfaToken,
  generateBackupCodes,
  hash,
  encrypt,
  decrypt
} from '@/utils/crypto';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError
} from '@/utils/errors';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MfaValidationResult {
  success: boolean;
  backupCodeUsed?: boolean;
}

export class MfaService {
  // Generate TOTP secret for user
  static async setupTotp(userId: string): Promise<MfaSetupResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `MCP SaaS (${user.email})`,
        issuer: 'MCP SaaS Platform',
        length: 32,
      });

      // Generate backup codes
      const backupCodes = generateBackupCodes(10);
      const hashedBackupCodes = backupCodes.map(code => hash(code));

      // Encrypt the secret for storage
      const encryptedSecret = encrypt(secret.base32, process.env.MFA_ENCRYPTION_KEY!);

      // Store MFA settings
      await prisma.mfaSettings.upsert({
        where: { userId },
        update: {
          totpSecret: encryptedSecret,
          backupCodes: hashedBackupCodes,
          isEnabled: false, // User needs to verify first
          lastUsedAt: null,
        },
        create: {
          userId,
          totpSecret: encryptedSecret,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
          createdAt: new Date(),
        },
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

      logger.info('MFA setup initiated', { userId });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes,
      };
    } catch (error) {
      logger.error('MFA setup failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Verify TOTP token and enable MFA
  static async enableTotp(userId: string, token: string): Promise<void> {
    try {
      const mfaSettings = await prisma.mfaSettings.findUnique({
        where: { userId },
      });

      if (!mfaSettings || !mfaSettings.totpSecret) {
        throw new NotFoundError('MFA setup not found');
      }

      if (mfaSettings.isEnabled) {
        throw new ValidationError('MFA is already enabled');
      }

      // Decrypt secret
      const secret = decrypt(mfaSettings.totpSecret, process.env.MFA_ENCRYPTION_KEY!);

      // Verify token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow for clock drift
      });

      if (!verified) {
        throw new AuthenticationError('Invalid MFA token');
      }

      // Enable MFA
      await prisma.mfaSettings.update({
        where: { userId },
        data: {
          isEnabled: true,
          lastUsedAt: new Date(),
        },
      });

      logger.info('MFA enabled successfully', { userId });
    } catch (error) {
      logger.error('MFA enable failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Verify TOTP token or backup code
  static async verifyToken(userId: string, token: string): Promise<MfaValidationResult> {
    try {
      const mfaSettings = await prisma.mfaSettings.findUnique({
        where: { userId },
      });

      if (!mfaSettings || !mfaSettings.isEnabled) {
        throw new NotFoundError('MFA not enabled for user');
      }

      // Check if it's a backup code (8-character format)
      if (token.length === 9 && token.includes('-')) {
        return await this.verifyBackupCode(userId, token, mfaSettings);
      }

      // Verify TOTP token
      if (!mfaSettings.totpSecret) {
        throw new ValidationError('TOTP not configured');
      }

      const secret = decrypt(mfaSettings.totpSecret, process.env.MFA_ENCRYPTION_KEY!);

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (!verified) {
        // Log failed attempt
        logger.warn('MFA verification failed', {
          userId,
          tokenLength: token.length
        });
        throw new AuthenticationError('Invalid MFA token');
      }

      // Update last used
      await prisma.mfaSettings.update({
        where: { userId },
        data: { lastUsedAt: new Date() },
      });

      logger.info('MFA verification successful', { userId });

      return { success: true };
    } catch (error) {
      logger.error('MFA verification failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Verify backup code
  private static async verifyBackupCode(
    userId: string,
    code: string,
    mfaSettings: any
  ): Promise<MfaValidationResult> {
    try {
      const hashedCode = hash(code);
      const codeIndex = mfaSettings.backupCodes.indexOf(hashedCode);

      if (codeIndex === -1) {
        throw new AuthenticationError('Invalid backup code');
      }

      // Remove used backup code
      const updatedBackupCodes = [...mfaSettings.backupCodes];
      updatedBackupCodes.splice(codeIndex, 1);

      await prisma.mfaSettings.update({
        where: { userId },
        data: {
          backupCodes: updatedBackupCodes,
          lastUsedAt: new Date(),
        },
      });

      logger.info('Backup code used successfully', {
        userId,
        remainingCodes: updatedBackupCodes.length
      });

      return { success: true, backupCodeUsed: true };
    } catch (error) {
      logger.error('Backup code verification failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Disable MFA
  static async disableMfa(userId: string, currentPassword: string): Promise<void> {
    try {
      // Verify user password first
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const { comparePassword } = await import('@/utils/crypto');
      const isPasswordValid = await comparePassword(currentPassword, user.password);

      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid password');
      }

      // Disable MFA
      await prisma.mfaSettings.delete({
        where: { userId },
      });

      logger.info('MFA disabled', { userId });
    } catch (error) {
      logger.error('MFA disable failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Generate new backup codes
  static async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const mfaSettings = await prisma.mfaSettings.findUnique({
        where: { userId },
      });

      if (!mfaSettings) {
        throw new NotFoundError('MFA not enabled for user');
      }

      // Generate new backup codes
      const backupCodes = generateBackupCodes(10);
      const hashedBackupCodes = backupCodes.map(code => hash(code));

      await prisma.mfaSettings.update({
        where: { userId },
        data: { backupCodes: hashedBackupCodes },
      });

      logger.info('Backup codes regenerated', { userId });

      return backupCodes;
    } catch (error) {
      logger.error('Backup code regeneration failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Get MFA status
  static async getMfaStatus(userId: string): Promise<{
    isEnabled: boolean;
    hasTotp: boolean;
    backupCodesRemaining: number;
    lastUsed?: Date;
  }> {
    try {
      const mfaSettings = await prisma.mfaSettings.findUnique({
        where: { userId },
      });

      if (!mfaSettings) {
        return {
          isEnabled: false,
          hasTotp: false,
          backupCodesRemaining: 0,
        };
      }

      return {
        isEnabled: mfaSettings.isEnabled,
        hasTotp: !!mfaSettings.totpSecret,
        backupCodesRemaining: mfaSettings.backupCodes.length,
        lastUsed: mfaSettings.lastUsedAt || undefined,
      };
    } catch (error) {
      logger.error('Get MFA status failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Check if user requires MFA for admin operations
  static async requiresMfaForAdmin(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
        include: {
          mfaSettings: true,
        },
      });

      if (!user) {
        return false;
      }

      // Require MFA for admin roles
      const adminRoles = ['ADMIN', 'SUPER_ADMIN'];
      return adminRoles.includes(user.role) && user.mfaSettings?.isEnabled === true;
    } catch (error) {
      logger.error('MFA admin check failed', {
        error: (error as Error).message,
        userId
      });
      return false;
    }
  }

  // Send MFA token via SMS (placeholder for future implementation)
  static async sendSmsToken(userId: string, phoneNumber: string): Promise<void> {
    try {
      const token = generateMfaToken(6);

      // Store token with expiration (5 minutes)
      await prisma.smsToken.upsert({
        where: { userId },
        update: {
          token: hash(token),
          phoneNumber,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
        },
        create: {
          userId,
          token: hash(token),
          phoneNumber,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
        },
      });

      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      logger.info('SMS MFA token generated', { userId, phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*') });

      // For development, log the token (remove in production)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('SMS MFA token (dev only)', { token });
      }
    } catch (error) {
      logger.error('SMS MFA token generation failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }

  // Verify SMS token (placeholder for future implementation)
  static async verifySmsToken(userId: string, token: string): Promise<boolean> {
    try {
      const smsToken = await prisma.smsToken.findUnique({
        where: { userId },
      });

      if (!smsToken) {
        throw new NotFoundError('No SMS token found');
      }

      if (smsToken.expiresAt < new Date()) {
        await prisma.smsToken.delete({ where: { userId } });
        throw new AuthenticationError('SMS token expired');
      }

      if (smsToken.attempts >= 3) {
        await prisma.smsToken.delete({ where: { userId } });
        throw new AuthenticationError('Too many attempts');
      }

      const hashedToken = hash(token);
      if (smsToken.token !== hashedToken) {
        await prisma.smsToken.update({
          where: { userId },
          data: { attempts: smsToken.attempts + 1 },
        });
        throw new AuthenticationError('Invalid SMS token');
      }

      // Clean up used token
      await prisma.smsToken.delete({ where: { userId } });

      logger.info('SMS MFA verification successful', { userId });
      return true;
    } catch (error) {
      logger.error('SMS MFA verification failed', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }
}