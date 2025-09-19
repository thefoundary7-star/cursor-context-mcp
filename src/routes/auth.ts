import { Router, Request, Response } from 'express';
import { AuthService } from '@/services/authService';
import { LicenseService } from '@/services/licenseService';
import { authenticate, validateLicense } from '@/middleware/auth';
import { 
  validateLogin, 
  validateRefreshToken, 
  validateChangePassword,
  validateLicenseValidation,
  validateCreateLicense 
} from '@/utils/validation';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse } from '@/types';

const router = Router();

// POST /api/auth/login
router.post('/login', validateLogin, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  const result = await AuthService.login({ email, password });
  
  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Login successful',
  };
  
  res.json(response);
}));

// POST /api/auth/refresh
router.post('/refresh', validateRefreshToken, asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  const result = await AuthService.refreshToken(refreshToken);
  
  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Token refreshed successfully',
  };
  
  res.json(response);
}));

// POST /api/auth/change-password
router.post('/change-password', authenticate, validateChangePassword, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;
  
  await AuthService.changePassword(userId, currentPassword, newPassword);
  
  const response: ApiResponse = {
    success: true,
    message: 'Password changed successfully',
  };
  
  res.json(response);
}));

// POST /api/auth/validate-license
router.post('/validate-license', validateLicenseValidation, asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, serverId, serverName, serverVersion } = req.body;
  
  const result = await LicenseService.validateLicense({
    licenseKey,
    serverId,
    serverName,
    serverVersion,
  });
  
  const response: ApiResponse = {
    success: result.valid,
    data: result,
    message: result.valid ? 'License validated successfully' : result.message,
  };
  
  res.json(response);
}));

// POST /api/auth/create-license
router.post('/create-license', authenticate, validateCreateLicense, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, plan, maxServers, expiresAt } = req.body;
  const userId = req.user!.id;
  
  const license = await LicenseService.createLicense(userId, {
    name,
    description,
    plan,
    maxServers,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });
  
  const response: ApiResponse = {
    success: true,
    data: license,
    message: 'License created successfully',
  };
  
  res.json(response);
}));

// GET /api/auth/profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  const user = await AuthService.getUserProfile(userId);
  
  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'Profile retrieved successfully',
  };
  
  res.json(response);
}));

// PUT /api/auth/profile
router.put('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { firstName, lastName, company } = req.body;
  
  const user = await AuthService.updateUserProfile(userId, {
    firstName,
    lastName,
    company,
  });
  
  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'Profile updated successfully',
  };
  
  res.json(response);
}));

// POST /api/auth/request-password-reset
router.post('/request-password-reset', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required',
    });
  }
  
  await AuthService.requestPasswordReset(email);
  
  const response: ApiResponse = {
    success: true,
    message: 'Password reset email sent if account exists',
  };
  
  res.json(response);
}));

// POST /api/auth/verify-email
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { userId, verificationToken } = req.body;
  
  if (!userId || !verificationToken) {
    return res.status(400).json({
      success: false,
      error: 'User ID and verification token are required',
    });
  }
  
  await AuthService.verifyEmail(userId, verificationToken);
  
  const response: ApiResponse = {
    success: true,
    message: 'Email verified successfully',
  };
  
  res.json(response);
}));

// DELETE /api/auth/deactivate-account
router.delete('/deactivate-account', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  
  await AuthService.deactivateUser(userId);
  
  const response: ApiResponse = {
    success: true,
    message: 'Account deactivated successfully',
  };
  
  res.json(response);
}));

export default router;
