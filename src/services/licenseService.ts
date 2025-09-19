import { PrismaClient, License, Server } from '@prisma/client';
import { generateLicenseKey } from '@/utils/crypto';
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

  // Validate license key
  static async validateLicense(
    validationData: LicenseValidationRequest
  ): Promise<LicenseValidationResponse> {
    try {
      // Find license
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

      // Check server quota
      if (license.servers.length >= license.maxServers) {
        return {
          valid: false,
          message: 'Server quota exceeded',
        };
      }

      // Find or create server
      let server = await prisma.server.findUnique({
        where: { serverId: validationData.serverId },
      });

      if (!server) {
        // Create new server
        server = await prisma.server.create({
          data: {
            licenseId: license.id,
            serverId: validationData.serverId,
            name: validationData.serverName,
            version: validationData.serverVersion,
          },
        });

        logger.info('New server registered', { 
          serverId: server.id, 
          licenseId: license.id 
        });
      } else {
        // Update existing server
        server = await prisma.server.update({
          where: { id: server.id },
          data: {
            name: validationData.serverName,
            version: validationData.serverVersion,
            lastSeen: new Date(),
            isActive: true,
          },
        });

        logger.info('Server updated', { 
          serverId: server.id, 
          licenseId: license.id 
        });
      }

      // Remove sensitive data from license
      const { userId, ...licenseWithoutUserId } = license;

      return {
        valid: true,
        license: licenseWithoutUserId,
        server,
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
}
