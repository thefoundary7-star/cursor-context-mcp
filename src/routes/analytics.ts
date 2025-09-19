import { Router, Request, Response } from 'express';
import { AnalyticsService } from '@/services/analyticsService';
import { authenticate, authenticateApiKey } from '@/middleware/auth';
import { 
  validateTrackAnalytics, 
  validateAnalyticsQuery 
} from '@/utils/validation';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '@/types';

const router = Router();

// POST /api/analytics/track
router.post('/track', authenticateApiKey, validateTrackAnalytics, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { licenseKey, serverId, events } = req.body;
  
  const result = await AnalyticsService.trackAnalytics({
    licenseKey,
    serverId,
    events,
  });
  
  const response: ApiResponse = {
    success: true,
    data: result,
    message: `Successfully tracked ${result.processed} events`,
  };
  
  res.json(response);
}));

// GET /api/analytics
router.get('/', authenticate, validateAnalyticsQuery, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    licenseId,
    serverId,
    eventType,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = req.query;
  
  const userId = req.user!.id;
  
  const { analytics, total } = await AnalyticsService.getAnalytics({
    userId,
    licenseId: licenseId as string,
    serverId: serverId as string,
    eventType: eventType as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  });
  
  const totalPages = Math.ceil(total / parseInt(limit as string));
  
  const response: PaginatedResponse<typeof analytics> = {
    success: true,
    data: analytics,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages,
    },
    message: 'Analytics retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/analytics/summary
router.get('/summary', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    licenseId,
    serverId,
    startDate,
    endDate,
  } = req.query;
  
  const userId = req.user!.id;
  
  const summary = await AnalyticsService.getAnalyticsSummary(
    userId,
    licenseId as string,
    serverId as string,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined
  );
  
  const response: ApiResponse = {
    success: true,
    data: summary,
    message: 'Analytics summary retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/analytics/realtime/:licenseId
router.get('/realtime/:licenseId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { licenseId } = req.params;
  const userId = req.user!.id;
  
  // Verify user owns this license
  const { LicenseService } = await import('@/services/licenseService');
  const license = await LicenseService.getLicenseById(licenseId, userId);
  
  const metrics = await AnalyticsService.getRealTimeMetrics(licenseId);
  
  const response: ApiResponse = {
    success: true,
    data: metrics,
    message: 'Real-time metrics retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/analytics/export
router.get('/export', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    format = 'json',
    licenseId,
    serverId,
    eventType,
    startDate,
    endDate,
  } = req.query;
  
  const userId = req.user!.id;
  
  const exportData = await AnalyticsService.exportAnalytics(
    userId,
    format as 'json' | 'csv',
    {
      userId,
      licenseId: licenseId as string,
      serverId: serverId as string,
      eventType: eventType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    }
  );
  
  const contentType = format === 'csv' ? 'text/csv' : 'application/json';
  const filename = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(exportData);
}));

// POST /api/analytics/cleanup (Admin only)
router.post('/cleanup', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { retentionDays = 90 } = req.body;
  
  // Check if user is admin
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  
  const deletedCount = await AnalyticsService.cleanupOldAnalytics(retentionDays);
  
  const response: ApiResponse = {
    success: true,
    data: { deletedCount, retentionDays },
    message: `Cleaned up ${deletedCount} old analytics records`,
  };
  
  res.json(response);
}));

// GET /api/analytics/events/types
router.get('/events/types', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const eventTypes = [
    'SERVER_START',
    'SERVER_STOP',
    'REQUEST_COUNT',
    'ERROR_COUNT',
    'FEATURE_USAGE',
    'QUOTA_EXCEEDED',
    'LICENSE_VALIDATION',
    'HEARTBEAT',
  ];
  
  const response: ApiResponse = {
    success: true,
    data: eventTypes,
    message: 'Event types retrieved successfully',
  };
  
  res.json(response);
}));

// GET /api/analytics/quota/:licenseId
router.get('/quota/:licenseId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { licenseId } = req.params;
  const userId = req.user!.id;
  
  // Verify user owns this license
  const { LicenseService } = await import('@/services/licenseService');
  const license = await LicenseService.getLicenseById(licenseId, userId);
  
  const quota = await LicenseService.getUsageQuota(licenseId);
  
  const response: ApiResponse = {
    success: true,
    data: quota,
    message: 'Usage quota retrieved successfully',
  };
  
  res.json(response);
}));

export default router;
