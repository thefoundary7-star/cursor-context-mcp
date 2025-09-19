import { PrismaClient, Analytics } from '@prisma/client';
import { 
  NotFoundError, 
  ValidationError,
  QuotaExceededError 
} from '@/utils/errors';
import { 
  TrackAnalyticsRequest, 
  AnalyticsQuery,
  AnalyticsEvent 
} from '@/types';
import logger from '@/utils/logger';
import { LicenseService } from './licenseService';

const prisma = new PrismaClient();

export class AnalyticsService {
  // Track analytics events
  static async trackAnalytics(
    trackingData: TrackAnalyticsRequest
  ): Promise<{ success: boolean; processed: number }> {
    try {
      // Validate license
      const license = await prisma.license.findUnique({
        where: { licenseKey: trackingData.licenseKey },
        include: {
          servers: {
            where: { serverId: trackingData.serverId },
          },
        },
      });

      if (!license) {
        throw new NotFoundError('License not found');
      }

      if (!license.isActive) {
        throw new ValidationError('License is deactivated');
      }

      const server = license.servers[0];
      if (!server) {
        throw new NotFoundError('Server not found for this license');
      }

      // Check quota before processing
      await LicenseService.checkQuota(license.id);

      // Process events in batches
      const batchSize = 100;
      let processed = 0;

      for (let i = 0; i < trackingData.events.length; i += batchSize) {
        const batch = trackingData.events.slice(i, i + batchSize);
        
        const analyticsData = batch.map((event: AnalyticsEvent) => ({
          userId: license.userId,
          licenseId: license.id,
          serverId: server.id,
          eventType: event.eventType,
          eventData: event.eventData || {},
          metadata: event.metadata || {},
          timestamp: event.timestamp || new Date(),
        }));

        await prisma.analytics.createMany({
          data: analyticsData,
        });

        processed += batch.length;
      }

      // Update server last seen
      await prisma.server.update({
        where: { id: server.id },
        data: { lastSeen: new Date() },
      });

      logger.info('Analytics tracked successfully', {
        licenseId: license.id,
        serverId: server.id,
        eventsProcessed: processed,
      });

      return { success: true, processed };
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        logger.warn('Analytics tracking failed due to quota exceeded', {
          licenseKey: trackingData.licenseKey,
          error: error.message,
        });
        throw error;
      }

      logger.error('Analytics tracking failed', {
        error: (error as Error).message,
        licenseKey: trackingData.licenseKey,
      });
      throw error;
    }
  }

  // Get analytics data
  static async getAnalytics(
    query: AnalyticsQuery
  ): Promise<{ analytics: Analytics[]; total: number }> {
    try {
      const {
        userId,
        licenseId,
        serverId,
        eventType,
        startDate,
        endDate,
        page = 1,
        limit = 10,
      } = query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (userId) where.userId = userId;
      if (licenseId) where.licenseId = licenseId;
      if (serverId) where.serverId = serverId;
      if (eventType) where.eventType = eventType;

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      const [analytics, total] = await Promise.all([
        prisma.analytics.findMany({
          where,
          include: {
            license: {
              select: {
                id: true,
                name: true,
                plan: true,
              },
            },
            server: {
              select: {
                id: true,
                serverId: true,
                name: true,
                version: true,
              },
            },
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
        }),
        prisma.analytics.count({ where }),
      ]);

      return { analytics, total };
    } catch (error) {
      logger.error('Get analytics failed', {
        error: (error as Error).message,
        query,
      });
      throw error;
    }
  }

  // Get analytics summary
  static async getAnalyticsSummary(
    userId: string,
    licenseId?: string,
    serverId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByDay: Record<string, number>;
    topServers: Array<{ serverId: string; count: number }>;
  }> {
    try {
      // Build where clause
      const where: any = { userId };
      if (licenseId) where.licenseId = licenseId;
      if (serverId) where.serverId = serverId;

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      // Get total events
      const totalEvents = await prisma.analytics.count({ where });

      // Get events by type
      const eventsByTypeResult = await prisma.analytics.groupBy({
        by: ['eventType'],
        where,
        _count: {
          eventType: true,
        },
      });

      const eventsByType = eventsByTypeResult.reduce((acc, item) => {
        acc[item.eventType] = item._count.eventType;
        return acc;
      }, {} as Record<string, number>);

      // Get events by day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const eventsByDayResult = await prisma.analytics.groupBy({
        by: ['timestamp'],
        where: {
          ...where,
          timestamp: {
            gte: thirtyDaysAgo,
          },
        },
        _count: {
          timestamp: true,
        },
      });

      const eventsByDay = eventsByDayResult.reduce((acc, item) => {
        const date = item.timestamp.toISOString().split('T')[0];
        acc[date] = item._count.timestamp;
        return acc;
      }, {} as Record<string, number>);

      // Get top servers
      const topServersResult = await prisma.analytics.groupBy({
        by: ['serverId'],
        where,
        _count: {
          serverId: true,
        },
        orderBy: {
          _count: {
            serverId: 'desc',
          },
        },
        take: 10,
      });

      const topServers = await Promise.all(
        topServersResult.map(async (item) => {
          const server = await prisma.server.findUnique({
            where: { id: item.serverId },
            select: { serverId: true },
          });
          return {
            serverId: server?.serverId || 'Unknown',
            count: item._count.serverId,
          };
        })
      );

      return {
        totalEvents,
        eventsByType,
        eventsByDay,
        topServers,
      };
    } catch (error) {
      logger.error('Get analytics summary failed', {
        error: (error as Error).message,
        userId,
        licenseId,
        serverId,
      });
      throw error;
    }
  }

  // Get real-time metrics
  static async getRealTimeMetrics(
    licenseId: string
  ): Promise<{
    activeServers: number;
    requestsLastHour: number;
    errorsLastHour: number;
    averageResponseTime: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Get active servers
      const activeServers = await prisma.server.count({
        where: {
          licenseId,
          isActive: true,
          lastSeen: {
            gte: oneHourAgo,
          },
        },
      });

      // Get requests in last hour
      const requestsLastHour = await prisma.analytics.count({
        where: {
          licenseId,
          eventType: 'REQUEST_COUNT',
          timestamp: {
            gte: oneHourAgo,
          },
        },
      });

      // Get errors in last hour
      const errorsLastHour = await prisma.analytics.count({
        where: {
          licenseId,
          eventType: 'ERROR_COUNT',
          timestamp: {
            gte: oneHourAgo,
          },
        },
      });

      // Calculate average response time (mock data for now)
      const averageResponseTime = 150; // ms

      return {
        activeServers,
        requestsLastHour,
        errorsLastHour,
        averageResponseTime,
      };
    } catch (error) {
      logger.error('Get real-time metrics failed', {
        error: (error as Error).message,
        licenseId,
      });
      throw error;
    }
  }

  // Clean up old analytics data
  static async cleanupOldAnalytics(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.analytics.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Analytics cleanup completed', {
        deletedCount: result.count,
        retentionDays,
      });

      return result.count;
    } catch (error) {
      logger.error('Analytics cleanup failed', {
        error: (error as Error).message,
        retentionDays,
      });
      throw error;
    }
  }

  // Export analytics data
  static async exportAnalytics(
    userId: string,
    format: 'json' | 'csv' = 'json',
    query?: AnalyticsQuery
  ): Promise<string> {
    try {
      const { analytics } = await this.getAnalytics({
        ...query,
        userId,
        limit: 10000, // Large limit for export
      });

      if (format === 'csv') {
        // Convert to CSV format
        const headers = [
          'timestamp',
          'eventType',
          'licenseId',
          'serverId',
          'eventData',
          'metadata',
        ];

        const csvRows = [
          headers.join(','),
          ...analytics.map((item) =>
            [
              item.timestamp.toISOString(),
              item.eventType,
              item.licenseId || '',
              item.serverId || '',
              JSON.stringify(item.eventData),
              JSON.stringify(item.metadata),
            ].join(',')
          ),
        ];

        return csvRows.join('\n');
      }

      // Return JSON format
      return JSON.stringify(analytics, null, 2);
    } catch (error) {
      logger.error('Export analytics failed', {
        error: (error as Error).message,
        userId,
        format,
      });
      throw error;
    }
  }
}
