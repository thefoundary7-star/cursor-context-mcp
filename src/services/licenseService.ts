import { PrismaClient, License, Server } from '@prisma/client';
import {
  generateLicenseKey,
  generateHardwareFingerprint,
  generateDigitalSignature,
  verifyDigitalSignature,
  hash,
  encrypt,
  decrypt
} from '@/utils/crypto';
import {
  NotFoundError,
  ConflictError,
  LicenseValidationError,
  QuotaExceededError
} from '@/utils/errors';
import { 
  LicenseValidationRequest, 
  LicenseValidationResponse, 
  CreateLicenseRequest,
  UsageQuota 
} from '@/types';
import logger from '@/utils/logger';

const prisma = new PrismaClient();

export class LicenseService {
  // Create a new license
  static async createLicense(
    userId: string,
    licenseData: CreateLicenseRequest
  ): Promise<License> {
    try {
      // Check if user has active subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (!subscription) {
        throw new ConflictError('No active subscription found');
      }

      // Generate unique license key
      let licenseKey: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        licenseKey = generateLicenseKey();
        const existingLicense = await prisma.license.findUnique({
          where: { licenseKey },
        });
        isUnique = !existingLicense;
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new ConflictError('Failed to generate unique license key');
      }

      // Create license
      const license = await prisma.license.create({
        data: {
          userId,
          licenseKey,
          name: licenseData.name,
          description: licenseData.description,
          plan: licenseData.plan as any,
          maxServers: licenseData.maxServers,
          expiresAt: licenseData.expiresAt,
        },
      });

      logger.info('License created successfully', { 
        licenseId: license.id, 
        userId, 
        plan: license.plan 
      });

      return license;
    } catch (error) {
      logger.error('License creation failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Enhanced license validation with hardware fingerprinting and digital signatures
  static async validateLicense(
    validationData: LicenseValidationRequest & {
      hardwareFingerprint?: string;
      signature?: string;
      clientTime?: number;
    }
  ): Promise<LicenseValidationResponse & {
    signature?: string;
    serverTime?: number;
    allowedHardware?: string[];
  }> {
    try {
      // DISABLE_LICENSE: Always return valid PRO license
      if (process.env.DISABLE_LICENSE === 'true') {
        logger.info('License validation bypassed - DISABLE_LICENSE=true');
        return {
          valid: true,
          license: {
            id: 'disabled-license',
            licenseKey: 'DISABLED-PRO-LICENSE',
            tier: 'PRO',
            isActive: true,
            expiresAt: null,
            maxServers: 10,
            plan: 'PRO'
          } as any,
          server: {
            id: 'disabled-server',
            serverId: validationData.serverId || 'disabled-server',
            name: 'Disabled License Server',
            version: '1.0.0',
            isActive: true
          } as any,
          signature: 'disabled-signature',
          serverTime: Date.now(),
          allowedHardware: []
        };
      }
      // Generate server-side hardware fingerprint if not provided
      const serverHardwareFingerprint = validationData.hardwareFingerprint || generateHardwareFingerprint();

      // Verify license signature if provided
      if (validationData.signature && process.env.LICENSE_PUBLIC_KEY) {
        const dataToVerify = JSON.stringify({
          licenseKey: validationData.licenseKey,
          serverId: validationData.serverId,
          hardwareFingerprint: serverHardwareFingerprint,
        });

        const isValidSignature = verifyDigitalSignature(
          dataToVerify,
          validationData.signature,
          process.env.LICENSE_PUBLIC_KEY
        );

        if (!isValidSignature) {
          logger.warn('Invalid license signature detected', {
            licenseKey: validationData.licenseKey.substring(0, 8) + '...',
            serverId: validationData.serverId,
          });
          return {
            valid: false,
            message: 'Invalid license signature',
          };
        }
      }

      // Check for timing attacks (request too old/too new)
      if (validationData.clientTime) {
        const serverTime = Date.now();
        const timeDiff = Math.abs(serverTime - validationData.clientTime);
        const maxTimeDiff = 5 * 60 * 1000; // 5 minutes

        if (timeDiff > maxTimeDiff) {
          logger.warn('License validation timestamp out of range', {
            licenseKey: validationData.licenseKey.substring(0, 8) + '...',
            timeDiff,
          });
          return {
            valid: false,
            message: 'Request timestamp out of valid range',
          };
        }
      }

      // Find license with additional security checks
      const license = await prisma.license.findUnique({
        where: { licenseKey: validationData.licenseKey },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
            },
          },
          servers: {
            where: { isActive: true },
          },
          licenseSettings: true,
        },
      });

      if (!license) {
        return {
          valid: false,
          message: 'Invalid license key',
        };
      }

      // Check if license is active
      if (!license.isActive) {
        return {
          valid: false,
          message: 'License is deactivated',
        };
      }

      // Check if user is active
      if (!license.user.isActive) {
        return {
          valid: false,
          message: 'License owner account is deactivated',
        };
      }

      // Check if license is expired
      if (license.expiresAt && license.expiresAt < new Date()) {
        return {
          valid: false,
          message: 'License has expired',
        };
      }

      // Hardware fingerprinting validation
      const licenseSettings = license.licenseSettings;
      if (licenseSettings?.hardwareBinding) {
        const allowedFingerprints = licenseSettings.allowedHardwareFingerprints || [];

        if (allowedFingerprints.length > 0) {
          const hashedFingerprint = hash(serverHardwareFingerprint);

          if (!allowedFingerprints.includes(hashedFingerprint)) {
            // Check if we can add this hardware (first-time binding)
            if (allowedFingerprints.length === 0 && licenseSettings.maxHardwareFingerprints > 0) {
              // Auto-bind first hardware
              await this.addHardwareFingerprint(license.id, serverHardwareFingerprint);
              logger.info('Hardware fingerprint auto-bound to license', {
                licenseId: license.id,
                fingerprint: hashedFingerprint.substring(0, 8) + '...',
              });
            } else {
              logger.warn('Hardware fingerprint mismatch', {
                licenseId: license.id,
                serverId: validationData.serverId,
                providedFingerprint: hashedFingerprint.substring(0, 8) + '...',
              });
              return {
                valid: false,
                message: 'Hardware fingerprint not authorized for this license',
              };
            }
          }
        }
      }

      // Check server quota
      if (license.servers.length >= license.maxServers) {
        return {
          valid: false,
          message: 'Server quota exceeded',
        };
      }

      // Enhanced server registration security
      const existingServerWithSameId = await prisma.server.findFirst({
        where: {
          serverId: validationData.serverId,
          licenseId: { not: license.id },
          isActive: true,
        },
      });

      if (existingServerWithSameId) {
        logger.warn('Server ID already registered to different license', {
          serverId: validationData.serverId,
          existingLicenseId: existingServerWithSameId.licenseId,
          requestedLicenseId: license.id,
        });
        return {
          valid: false,
          message: 'Server ID already registered to another license',
        };
      }

      // Find or create server with enhanced security
      let server = await prisma.server.findUnique({
        where: { serverId: validationData.serverId },
      });

      if (!server) {
        // Create new server with hardware fingerprint
        server = await prisma.server.create({
          data: {
            licenseId: license.id,
            serverId: validationData.serverId,
            name: validationData.serverName,
            version: validationData.serverVersion,
            hardwareFingerprint: hash(serverHardwareFingerprint),
            registeredAt: new Date(),
          },
        });

        logger.info('New server registered with hardware fingerprint', {
          serverId: server.id,
          licenseId: license.id,
          fingerprint: hash(serverHardwareFingerprint).substring(0, 8) + '...',
        });
      } else {
        // Update existing server and verify hardware fingerprint
        const storedFingerprint = server.hardwareFingerprint;
        const currentFingerprint = hash(serverHardwareFingerprint);

        if (storedFingerprint && storedFingerprint !== currentFingerprint) {
          logger.warn('Hardware fingerprint mismatch for existing server', {
            serverId: server.id,
            licenseId: license.id,
            stored: storedFingerprint.substring(0, 8) + '...',
            current: currentFingerprint.substring(0, 8) + '...',
          });

          // Allow update if hardware binding is not strict
          if (!licenseSettings?.strictHardwareBinding) {
            server.hardwareFingerprint = currentFingerprint;
          } else {
            return {
              valid: false,
              message: 'Hardware fingerprint mismatch - strict binding enabled',
            };
          }
        }

        server = await prisma.server.update({
          where: { id: server.id },
          data: {
            name: validationData.serverName,
            version: validationData.serverVersion,
            hardwareFingerprint: server.hardwareFingerprint || currentFingerprint,
            lastSeen: new Date(),
            isActive: true,
          },
        });

        logger.info('Server updated with security validation', {
          serverId: server.id,
          licenseId: license.id,
        });
      }

      // Generate digital signature for response
      let responseSignature: string | undefined;
      if (process.env.LICENSE_PRIVATE_KEY) {
        const responseData = JSON.stringify({
          licenseKey: validationData.licenseKey,
          serverId: validationData.serverId,
          serverTime: Date.now(),
          valid: true,
        });

        try {
          responseSignature = generateDigitalSignature(responseData, process.env.LICENSE_PRIVATE_KEY);
        } catch (error) {
          logger.error('Failed to generate response signature', {
            error: (error as Error).message,
            licenseId: license.id,
          });
        }
      }

      // Remove sensitive data from license
      const { userId, licenseSettings: settings, ...licenseWithoutSensitiveData } = license;

      return {
        valid: true,
        license: licenseWithoutSensitiveData,
        server,
        signature: responseSignature,
        serverTime: Date.now(),
        allowedHardware: settings?.allowedHardwareFingerprints?.map(fp =>
          fp.substring(0, 8) + '...'
        ),
      };
    } catch (error) {
      logger.error('License validation failed', { 
        error: (error as Error).message, 
        licenseKey: validationData.licenseKey 
      });
      throw error;
    }
  }

  // Get user's licenses
  static async getUserLicenses(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ licenses: License[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [licenses, total] = await Promise.all([
        prisma.license.findMany({
          where: { userId },
          include: {
            servers: {
              where: { isActive: true },
            },
            _count: {
              select: {
                servers: true,
                analytics: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.license.count({
          where: { userId },
        }),
      ]);

      return { licenses, total };
    } catch (error) {
      logger.error('Get user licenses failed', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  // Get license by ID
  static async getLicenseById(licenseId: string, userId: string): Promise<License> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          userId,
        },
        include: {
          servers: {
            where: { isActive: true },
          },
          _count: {
            select: {
              servers: true,
              analytics: true,
            },
          },
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      return license;
    } catch (error) {
      logger.error('Get license by ID failed', { 
        error: (error as Error).message, 
        licenseId, 
        userId 
      });
      throw error;
    }
  }

  // Update license
  static async updateLicense(
    licenseId: string,
    userId: string,
    updateData: {
      name?: string;
      description?: string;
      maxServers?: number;
      expiresAt?: Date;
    }
  ): Promise<License> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          userId,
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      const updatedLicense = await prisma.license.update({
        where: { id: licenseId },
        data: updateData,
      });

      logger.info('License updated successfully', { 
        licenseId, 
        userId 
      });

      return updatedLicense;
    } catch (error) {
      logger.error('License update failed', { 
        error: (error as Error).message, 
        licenseId, 
        userId 
      });
      throw error;
    }
  }

  // Deactivate license
  static async deactivateLicense(licenseId: string, userId: string): Promise<void> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          userId,
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      await prisma.license.update({
        where: { id: licenseId },
        data: { isActive: false },
      });

      // Deactivate all servers under this license
      await prisma.server.updateMany({
        where: { licenseId },
        data: { isActive: false },
      });

      logger.info('License deactivated successfully', { 
        licenseId, 
        userId 
      });
    } catch (error) {
      logger.error('License deactivation failed', { 
        error: (error as Error).message, 
        licenseId, 
        userId 
      });
      throw error;
    }
  }

  // Get usage quota for a license
  static async getUsageQuota(licenseId: string): Promise<UsageQuota> {
    try {
      const license = await prisma.license.findUnique({
        where: { id: licenseId },
        include: {
          servers: {
            where: { isActive: true },
          },
          analytics: {
            where: {
              timestamp: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
          },
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      // Calculate current usage
      const currentUsage = {
        servers: license.servers.length,
        requestsThisMonth: license.analytics.filter(
          a => a.eventType === 'REQUEST_COUNT'
        ).length,
        analyticsEvents: license.analytics.length,
      };

      // Define plan limits
      const planLimits = {
        FREE: { maxServers: 1, maxRequestsPerMonth: 1000, maxAnalyticsEvents: 10000 },
        BASIC: { maxServers: 5, maxRequestsPerMonth: 10000, maxAnalyticsEvents: 100000 },
        PRO: { maxServers: 20, maxRequestsPerMonth: 100000, maxAnalyticsEvents: 1000000 },
        ENTERPRISE: { maxServers: 100, maxRequestsPerMonth: 1000000, maxAnalyticsEvents: 10000000 },
      };

      const limits = planLimits[license.plan] || planLimits.FREE;

      return {
        plan: license.plan,
        maxServers: limits.maxServers,
        maxRequestsPerMonth: limits.maxRequestsPerMonth,
        maxAnalyticsEvents: limits.maxAnalyticsEvents,
        currentUsage,
      };
    } catch (error) {
      logger.error('Get usage quota failed', { 
        error: (error as Error).message, 
        licenseId 
      });
      throw error;
    }
  }

  // Check if quota is exceeded
  static async checkQuota(licenseId: string): Promise<void> {
    try {
      const quota = await this.getUsageQuota(licenseId);

      if (quota.currentUsage.servers >= quota.maxServers) {
        throw new QuotaExceededError(
          'servers',
          quota.currentUsage.servers,
          quota.maxServers
        );
      }

      if (quota.currentUsage.requestsThisMonth >= quota.maxRequestsPerMonth) {
        throw new QuotaExceededError(
          'requests',
          quota.currentUsage.requestsThisMonth,
          quota.maxRequestsPerMonth
        );
      }

      if (quota.currentUsage.analyticsEvents >= quota.maxAnalyticsEvents) {
        throw new QuotaExceededError(
          'analytics',
          quota.currentUsage.analyticsEvents,
          quota.maxAnalyticsEvents
        );
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw error;
      }
      logger.error('Quota check failed', { 
        error: (error as Error).message, 
        licenseId 
      });
      throw error;
    }
  }

  // Add hardware fingerprint to license
  static async addHardwareFingerprint(
    licenseId: string,
    hardwareFingerprint: string,
    userId?: string
  ): Promise<void> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          ...(userId && { userId }),
        },
        include: {
          licenseSettings: true,
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      const hashedFingerprint = hash(hardwareFingerprint);
      const currentFingerprints = license.licenseSettings?.allowedHardwareFingerprints || [];
      const maxFingerprints = license.licenseSettings?.maxHardwareFingerprints || 3;

      if (currentFingerprints.includes(hashedFingerprint)) {
        return; // Already exists
      }

      if (currentFingerprints.length >= maxFingerprints) {
        throw new ConflictError(`Maximum ${maxFingerprints} hardware fingerprints allowed`);
      }

      const updatedFingerprints = [...currentFingerprints, hashedFingerprint];

      await prisma.licenseSettings.upsert({
        where: { licenseId },
        update: {
          allowedHardwareFingerprints: updatedFingerprints,
        },
        create: {
          licenseId,
          hardwareBinding: true,
          allowedHardwareFingerprints: updatedFingerprints,
          maxHardwareFingerprints: maxFingerprints,
        },
      });

      logger.info('Hardware fingerprint added to license', {
        licenseId,
        fingerprint: hashedFingerprint.substring(0, 8) + '...',
        totalFingerprints: updatedFingerprints.length,
      });
    } catch (error) {
      logger.error('Add hardware fingerprint failed', {
        error: (error as Error).message,
        licenseId,
      });
      throw error;
    }
  }

  // Remove hardware fingerprint from license
  static async removeHardwareFingerprint(
    licenseId: string,
    hardwareFingerprint: string,
    userId: string
  ): Promise<void> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          userId,
        },
        include: {
          licenseSettings: true,
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      const hashedFingerprint = hash(hardwareFingerprint);
      const currentFingerprints = license.licenseSettings?.allowedHardwareFingerprints || [];
      const updatedFingerprints = currentFingerprints.filter(fp => fp !== hashedFingerprint);

      await prisma.licenseSettings.update({
        where: { licenseId },
        data: {
          allowedHardwareFingerprints: updatedFingerprints,
        },
      });

      logger.info('Hardware fingerprint removed from license', {
        licenseId,
        fingerprint: hashedFingerprint.substring(0, 8) + '...',
        remainingFingerprints: updatedFingerprints.length,
      });
    } catch (error) {
      logger.error('Remove hardware fingerprint failed', {
        error: (error as Error).message,
        licenseId,
      });
      throw error;
    }
  }

  // Get license settings including hardware fingerprints
  static async getLicenseSettings(licenseId: string, userId: string): Promise<any> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          userId,
        },
        include: {
          licenseSettings: true,
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      const settings = license.licenseSettings;
      if (!settings) {
        return {
          hardwareBinding: false,
          strictHardwareBinding: false,
          maxHardwareFingerprints: 3,
          allowedHardwareFingerprints: [],
          offlineCacheDuration: 24 * 60 * 60 * 1000, // 24 hours
        };
      }

      return {
        hardwareBinding: settings.hardwareBinding,
        strictHardwareBinding: settings.strictHardwareBinding,
        maxHardwareFingerprints: settings.maxHardwareFingerprints,
        allowedHardwareFingerprints: settings.allowedHardwareFingerprints?.map(fp =>
          fp.substring(0, 8) + '...'
        ),
        offlineCacheDuration: settings.offlineCacheDuration,
      };
    } catch (error) {
      logger.error('Get license settings failed', {
        error: (error as Error).message,
        licenseId,
      });
      throw error;
    }
  }

  // Update license settings
  static async updateLicenseSettings(
    licenseId: string,
    userId: string,
    settings: {
      hardwareBinding?: boolean;
      strictHardwareBinding?: boolean;
      maxHardwareFingerprints?: number;
      offlineCacheDuration?: number;
    }
  ): Promise<void> {
    try {
      const license = await prisma.license.findFirst({
        where: {
          id: licenseId,
          userId,
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      await prisma.licenseSettings.upsert({
        where: { licenseId },
        update: settings,
        create: {
          licenseId,
          ...settings,
        },
      });

      logger.info('License settings updated', {
        licenseId,
        settings,
      });
    } catch (error) {
      logger.error('Update license settings failed', {
        error: (error as Error).message,
        licenseId,
      });
      throw error;
    }
  }

  // Generate offline license cache
  static async generateOfflineCache(licenseKey: string): Promise<{
    cache: string;
    expiresAt: Date;
    signature: string;
  }> {
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: {
          licenseSettings: true,
          user: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      const cacheDuration = license.licenseSettings?.offlineCacheDuration || 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + cacheDuration);

      const cacheData = {
        licenseKey,
        licenseId: license.id,
        plan: license.plan,
        maxServers: license.maxServers,
        isActive: license.isActive,
        userActive: license.user.isActive,
        expiresAt: license.expiresAt,
        cacheExpiresAt: expiresAt,
        hardwareBinding: license.licenseSettings?.hardwareBinding || false,
        allowedHardwareFingerprints: license.licenseSettings?.allowedHardwareFingerprints || [],
      };

      const encryptedCache = encrypt(JSON.stringify(cacheData), process.env.LICENSE_CACHE_KEY!);
      let signature = '';

      if (process.env.LICENSE_PRIVATE_KEY) {
        signature = generateDigitalSignature(encryptedCache, process.env.LICENSE_PRIVATE_KEY);
      }

      logger.info('Offline license cache generated', {
        licenseId: license.id,
        expiresAt,
      });

      return {
        cache: encryptedCache,
        expiresAt,
        signature,
      };
    } catch (error) {
      logger.error('Generate offline cache failed', {
        error: (error as Error).message,
        licenseKey: licenseKey.substring(0, 8) + '...',
      });
      throw error;
    }
  }

  // Validate offline license cache
  static async validateOfflineCache(
    cache: string,
    signature: string,
    hardwareFingerprint?: string
  ): Promise<{ valid: boolean; data?: any; message?: string }> {
    try {
      // Verify signature first
      if (process.env.LICENSE_PUBLIC_KEY && signature) {
        const isValidSignature = verifyDigitalSignature(cache, signature, process.env.LICENSE_PUBLIC_KEY);
        if (!isValidSignature) {
          return {
            valid: false,
            message: 'Invalid cache signature',
          };
        }
      }

      // Decrypt cache
      const decryptedData = decrypt(cache, process.env.LICENSE_CACHE_KEY!);
      const cacheData = JSON.parse(decryptedData);

      // Check cache expiration
      if (new Date() > new Date(cacheData.cacheExpiresAt)) {
        return {
          valid: false,
          message: 'Offline cache expired',
        };
      }

      // Check license expiration
      if (cacheData.expiresAt && new Date() > new Date(cacheData.expiresAt)) {
        return {
          valid: false,
          message: 'License expired',
        };
      }

      // Check license and user status
      if (!cacheData.isActive || !cacheData.userActive) {
        return {
          valid: false,
          message: 'License or user deactivated',
        };
      }

      // Check hardware fingerprint if binding is enabled
      if (cacheData.hardwareBinding && hardwareFingerprint) {
        const hashedFingerprint = hash(hardwareFingerprint);
        if (!cacheData.allowedHardwareFingerprints.includes(hashedFingerprint)) {
          return {
            valid: false,
            message: 'Hardware fingerprint not authorized',
          };
        }
      }

      logger.info('Offline cache validation successful', {
        licenseId: cacheData.licenseId,
      });

      return {
        valid: true,
        data: cacheData,
      };
    } catch (error) {
      logger.error('Offline cache validation failed', {
        error: (error as Error).message,
      });
      return {
        valid: false,
        message: 'Cache validation failed',
      };
    }
  }
}
