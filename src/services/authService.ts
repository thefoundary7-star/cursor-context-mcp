import { PrismaClient, User } from '@prisma/client';
import { 
  hashPassword, 
  comparePassword, 
  generateAccessToken, 
  generateRefreshToken,
  verifyRefreshToken 
} from '@/utils/crypto';
import { 
  AuthenticationError, 
  NotFoundError, 
  ConflictError,
  CustomError 
} from '@/utils/errors';
import { LoginRequest, LoginResponse, JWTPayload } from '@/types';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

export class AuthService {
  // User registration
  static async register(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  }): Promise<Omit<User, 'password'>> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          company: userData.company,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create default free subscription
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: 'FREE',
          status: 'ACTIVE',
        },
      });

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return user;
    } catch (error) {
      logger.error('User registration failed', { error: (error as Error).message, email: userData.email });
      throw error;
    }
  }

  // User login
  static async login(loginData: LoginRequest): Promise<LoginResponse> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: loginData.email },
        include: {
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await comparePassword(loginData.password, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Generate tokens
      const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Remove password from user object
      const { password, ...userWithoutPassword } = user;

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('User login failed', { error: (error as Error).message, email: loginData.email });
      throw error;
    }
  }

  // Refresh access token
  static async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new AuthenticationError('User not found or deactivated');
      }

      // Generate new access token
      const newPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(newPayload);

      logger.info('Token refreshed successfully', { userId: user.id });

      return { accessToken };
    } catch (error) {
      logger.error('Token refresh failed', { error: (error as Error).message });
      throw error;
    }
  }

  // Change password
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed', { error: (error as Error).message, userId });
      throw error;
    }
  }

  // Reset password (for future implementation)
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });

      if (!user) {
        // Don't reveal if user exists or not
        logger.info('Password reset requested for non-existent user', { email });
        return;
      }

      // TODO: Implement email sending logic
      // For now, just log the request
      logger.info('Password reset requested', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Password reset request failed', { error: (error as Error).message, email });
      throw error;
    }
  }

  // Verify user email (for future implementation)
  static async verifyEmail(userId: string, verificationToken: string): Promise<void> {
    try {
      // TODO: Implement email verification logic
      logger.info('Email verification requested', { userId, verificationToken });
    } catch (error) {
      logger.error('Email verification failed', { error: (error as Error).message, userId });
      throw error;
    }
  }

  // Get user profile
  static async getUserProfile(userId: string): Promise<Omit<User, 'password'>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Get user profile failed', { error: (error as Error).message, userId });
      throw error;
    }
  }

  // Update user profile
  static async updateUserProfile(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      company?: string;
    }
  ): Promise<Omit<User, 'password'>> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('User profile updated successfully', { userId });

      return user;
    } catch (error) {
      logger.error('User profile update failed', { error: (error as Error).message, userId });
      throw error;
    }
  }

  // Deactivate user account
  static async deactivateUser(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      // Deactivate all user's licenses
      await prisma.license.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      // Deactivate all user's API keys
      await prisma.apiKey.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      logger.info('User account deactivated', { userId });
    } catch (error) {
      logger.error('User deactivation failed', { error: (error as Error).message, userId });
      throw error;
    }
  }
}
