import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { LicenseValidator } from './license-validator.js';
import { DatabaseManager } from './database-manager.js';
import { DodoPaymentsIntegration } from './dodo-integration.js';
import { SecurityManager } from './security-manager.js';
import type {
  LicenseValidationRequest,
  LicenseValidationResponse,
  LicenseGenerationRequest
} from './types.js';

export class LicenseAPIServer {
  private app: express.Application;
  private licenseValidator!: LicenseValidator;
  private databaseManager!: DatabaseManager;
  private dodoIntegration!: DodoPaymentsIntegration;
  private securityManager!: SecurityManager;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    const validationLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 20, // limit license validation to 20 requests per minute per IP
      message: 'License validation rate limit exceeded.'
    });
    this.app.use('/api/validate-license', validationLimiter);
  }

  private async initializeServices(): Promise<void> {
    this.databaseManager = new DatabaseManager();
    await this.databaseManager.initialize();

    this.securityManager = new SecurityManager();
    this.licenseValidator = new LicenseValidator(this.databaseManager, this.securityManager);
    this.dodoIntegration = new DodoPaymentsIntegration(this.databaseManager);
  }

  private setupRoutes(): void {
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    this.app.post('/api/validate-license', async (req, res) => {
      try {
        const validationRequest: LicenseValidationRequest = req.body;

        if (!this.isValidLicenseRequest(validationRequest)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request format',
            code: 'INVALID_REQUEST'
          });
        }

        const result = await this.licenseValidator.validateLicense(validationRequest);

        res.json(result);
      } catch (error) {
        console.error('License validation error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    });

    this.app.post('/api/generate-license', async (req, res) => {
      try {
        const generationRequest: LicenseGenerationRequest = req.body;

        if (!this.isValidGenerationRequest(generationRequest)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid generation request format'
          });
        }

        const license = await this.licenseValidator.generateLicense(generationRequest);

        res.json({
          success: true,
          licenseKey: license.licenseKey,
          tier: license.tier,
          expiresAt: license.expiresAt
        });
      } catch (error) {
        console.error('License generation error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate license'
        });
      }
    });

    this.app.post('/api/revoke-license', async (req, res) => {
      try {
        const { licenseKey, reason } = req.body;

        if (!licenseKey) {
          return res.status(400).json({
            success: false,
            error: 'License key is required'
          });
        }

        await this.licenseValidator.revokeLicense(licenseKey, reason);

        res.json({
          success: true,
          message: 'License revoked successfully'
        });
      } catch (error) {
        console.error('License revocation error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to revoke license'
        });
      }
    });

    this.app.post('/api/webhooks/dodo-payments', async (req, res) => {
      try {
        const isValid = await this.dodoIntegration.verifyWebhook(req.body, req.headers);

        if (!isValid) {
          return res.status(401).json({
            success: false,
            error: 'Webhook verification failed'
          });
        }

        await this.dodoIntegration.handleWebhook(req.body);

        res.json({ success: true });
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
          success: false,
          error: 'Webhook processing failed'
        });
      }
    });

    this.app.get('/api/license/:licenseKey/usage', async (req, res) => {
      try {
        const { licenseKey } = req.params;
        const usage = await this.licenseValidator.getLicenseUsage(licenseKey);

        res.json({
          success: true,
          usage
        });
      } catch (error) {
        console.error('Usage retrieval error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve usage'
        });
      }
    });
  }

  private isValidLicenseRequest(req: any): req is LicenseValidationRequest {
    return (
      typeof req === 'object' &&
      typeof req.licenseKey === 'string' &&
      typeof req.machineId === 'string' &&
      (req.features === undefined || Array.isArray(req.features))
    );
  }

  private isValidGenerationRequest(req: any): req is LicenseGenerationRequest {
    return (
      typeof req === 'object' &&
      typeof req.userId === 'string' &&
      typeof req.tier === 'string' &&
      ['FREE', 'PRO', 'ENTERPRISE'].includes(req.tier)
    );
  }

  async start(): Promise<void> {
    await this.initializeServices();

    this.app.listen(this.port, () => {
      console.log(`License API Server running on port ${this.port}`);
      console.log(`Health endpoint: http://localhost:${this.port}/api/health`);
      console.log(`License validation: http://localhost:${this.port}/api/validate-license`);
    });
  }

  async stop(): Promise<void> {
    await this.databaseManager.close();
  }
}