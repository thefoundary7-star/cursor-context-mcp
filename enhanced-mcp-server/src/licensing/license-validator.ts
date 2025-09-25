import crypto from 'crypto';
import { DatabaseManager } from './database-manager.js';
import { SecurityManager } from './security-manager.js';
import type {
  LicenseValidationRequest,
  LicenseValidationResponse,
  LicenseGenerationRequest,
  LicenseRecord,
  LicenseTier,
  MachineFingerprint
} from './types.js';

export class LicenseValidator {
  private databaseManager: DatabaseManager;
  private securityManager: SecurityManager;
  private licenseTiers!: Map<string, LicenseTier>;

  constructor(databaseManager: DatabaseManager, securityManager: SecurityManager) {
    this.databaseManager = databaseManager;
    this.securityManager = securityManager;
    this.initializeLicenseTiers();
  }

  private initializeLicenseTiers(): void {
    this.licenseTiers = new Map([
      ['FREE', {
        name: 'FREE',
        features: [
          'list_files',
          'read_file',
          'search_files',
          'get_file_stats'
        ],
        limits: {
          dailyCalls: 50,
          maxMachines: 1,
          concurrentSessions: 1
        }
      }],
      ['PRO', {
        name: 'PRO',
        features: [
          // All FREE features plus:
          'list_files',
          'read_file',
          'write_file',
          'search_files',
          'get_file_diff',
          'get_file_stats',
          'search_symbols',
          'find_references',
          'index_directory',
          'get_symbol_info',
          'run_tests',
          'detect_test_framework',
          'analyze_dependencies',
          'security_scan',
          'git_diff',
          'git_log',
          'git_blame',
          'analyze_performance',
          'monitor_files',
          'code_quality_check',
          'documentation_analysis',
          'refactor_suggestions',
          'bulk_operations',
          'advanced_search',
          'project_analytics',
          'code_metrics'
        ],
        limits: {
          dailyCalls: -1, // Unlimited
          maxMachines: 3,
          concurrentSessions: 5
        },
        price: {
          monthly: 29,
          yearly: 290
        }
      }],
      ['ENTERPRISE', {
        name: 'ENTERPRISE',
        features: [
          // All PRO features plus:
          'list_files',
          'read_file',
          'write_file',
          'search_files',
          'get_file_diff',
          'get_file_stats',
          'search_symbols',
          'find_references',
          'index_directory',
          'get_symbol_info',
          'run_tests',
          'detect_test_framework',
          'analyze_dependencies',
          'security_scan',
          'git_diff',
          'git_log',
          'git_blame',
          'analyze_performance',
          'monitor_files',
          'code_quality_check',
          'documentation_analysis',
          'refactor_suggestions',
          'bulk_operations',
          'advanced_search',
          'project_analytics',
          'code_metrics',
          'team_collaboration',
          'audit_logging',
          'priority_support',
          'custom_integrations'
        ],
        limits: {
          dailyCalls: -1, // Unlimited
          maxMachines: 10,
          concurrentSessions: 20
        },
        price: {
          monthly: 99,
          yearly: 990
        }
      }]
    ]);
  }

  async validateLicense(request: LicenseValidationRequest): Promise<LicenseValidationResponse> {
    try {
      // DISABLE_LICENSE: Always return valid PRO license
      if (process.env.DISABLE_LICENSE === 'true') {
        console.log('[DISABLE_LICENSE] License validation bypassed in validator - returning PRO tier');
        return {
          success: true,
          isValid: true,
          tier: 'PRO',
          features: [], // Will be populated by license manager
          limits: { dailyCalls: -1, maxMachines: 10, concurrentSessions: 20 },
          usage: { callsToday: 0, machinesUsed: 0, activeSessions: 0 },
          subscription: { status: 'active' }
        };
      }

      // Check cache first
      const cached = await this.databaseManager.getCachedValidation(request.licenseKey);
      if (cached && this.isCacheValid(cached, request.machineId)) {
        return cached;
      }

      // Get license from database
      const license = await this.databaseManager.getLicenseByKey(request.licenseKey);
      if (!license) {
        return this.createErrorResponse('License key not found', 'LICENSE_NOT_FOUND');
      }

      // Validate license status
      const statusValidation = this.validateLicenseStatus(license);
      if (!statusValidation.isValid) {
        return statusValidation;
      }

      // Validate machine limit
      const machineValidation = await this.validateMachineLimit(license, request.machineId);
      if (!machineValidation.isValid) {
        return machineValidation;
      }

      // Get usage data
      const dailyUsage = await this.databaseManager.getDailyUsage(license.id);
      const machines = await this.databaseManager.getMachinesForLicense(license.id);

      // Register/update machine
      const fingerprint = this.generateMachineFingerprint(request);
      await this.databaseManager.registerMachine(license.id, request.machineId, fingerprint.fingerprint);

      // Record usage
      await this.databaseManager.recordUsage(license.id, request.machineId, request.features || []);

      // Build response
      const tier = this.licenseTiers.get(license.tier)!;
      const response: LicenseValidationResponse = {
        success: true,
        isValid: true,
        tier: license.tier,
        features: tier.features,
        limits: {
          dailyCalls: license.customLimits?.dailyCalls || tier.limits.dailyCalls,
          maxMachines: license.maxMachines,
          concurrentSessions: license.customLimits?.concurrentSessions || tier.limits.concurrentSessions
        },
        usage: {
          callsToday: dailyUsage,
          machinesUsed: machines.length,
          activeSessions: 1 // TODO: Implement session tracking
        },
        subscription: {
          status: this.getSubscriptionStatus(license),
          expiresAt: license.expiresAt?.toISOString(),
          gracePeriodEnds: this.getGracePeriodEnd(license)?.toISOString()
        }
      };

      // Cache the result
      await this.databaseManager.setCachedValidation(request.licenseKey, response, 5);

      return response;

    } catch (error) {
      console.error('License validation error:', error);
      return this.createErrorResponse('Internal validation error', 'VALIDATION_ERROR');
    }
  }

  async generateLicense(request: LicenseGenerationRequest): Promise<LicenseRecord> {
    const licenseKey = this.generateLicenseKey(request.tier, request.userId);

    const license: Omit<LicenseRecord, 'id' | 'createdAt'> = {
      licenseKey,
      userId: request.userId,
      tier: request.tier,
      status: 'active',
      subscriptionId: request.subscriptionId,
      expiresAt: request.expiresAt ? new Date(request.expiresAt) : undefined,
      revokedAt: undefined,
      maxMachines: request.maxMachines || this.licenseTiers.get(request.tier)!.limits.maxMachines,
      customLimits: request.customLimits
    };

    return await this.databaseManager.createLicense(license);
  }

  async revokeLicense(licenseKey: string, reason?: string): Promise<void> {
    await this.databaseManager.updateLicenseStatus(licenseKey, 'revoked', reason);

    // Clear cache
    await this.clearLicenseCache(licenseKey);
  }

  async getLicenseUsage(licenseKey: string): Promise<any> {
    const license = await this.databaseManager.getLicenseByKey(licenseKey);
    if (!license) {
      throw new Error('License not found');
    }

    const dailyUsage = await this.databaseManager.getDailyUsage(license.id);
    const machines = await this.databaseManager.getMachinesForLicense(license.id);

    return {
      licenseKey,
      tier: license.tier,
      dailyUsage,
      machinesUsed: machines.length,
      maxMachines: license.maxMachines,
      machines: machines.map(m => ({
        machineId: m.machineId,
        firstSeen: m.firstSeen,
        lastSeen: m.lastSeen,
        isActive: m.isActive
      }))
    };
  }

  private validateLicenseStatus(license: LicenseRecord): LicenseValidationResponse {
    if (license.status === 'revoked') {
      return this.createErrorResponse('License has been revoked', 'LICENSE_REVOKED');
    }

    if (license.status === 'suspended') {
      return this.createErrorResponse('License is suspended', 'LICENSE_SUSPENDED');
    }

    if (license.expiresAt && new Date() > license.expiresAt) {
      // Check if in grace period (7 days after expiration)
      const gracePeriodEnd = new Date(license.expiresAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      if (new Date() > gracePeriodEnd) {
        return this.createErrorResponse('License has expired', 'LICENSE_EXPIRED');
      }
    }

    return { success: true, isValid: true } as LicenseValidationResponse;
  }

  private async validateMachineLimit(license: LicenseRecord, machineId: string): Promise<LicenseValidationResponse> {
    const machines = await this.databaseManager.getMachinesForLicense(license.id);
    const existingMachine = machines.find(m => m.machineId === machineId);

    if (!existingMachine && machines.length >= license.maxMachines) {
      return this.createErrorResponse(
        `Maximum number of machines (${license.maxMachines}) exceeded`,
        'MACHINE_LIMIT_EXCEEDED'
      );
    }

    return { success: true, isValid: true } as LicenseValidationResponse;
  }

  private generateLicenseKey(tier: string, userId: string): string {
    const prefix = tier.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36);
    const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
    const random = crypto.randomBytes(8).toString('hex');

    const key = `${prefix}-${timestamp}-${userHash}-${random}`.toUpperCase();

    // Add checksum
    const checksum = crypto.createHash('sha256').update(key).digest('hex').substring(0, 4);
    return `${key}-${checksum}`;
  }

  private generateMachineFingerprint(request: LicenseValidationRequest): MachineFingerprint {
    const components = {
      platform: process.platform,
      arch: process.arch,
      machineId: request.machineId,
      version: request.version || 'unknown'
    };

    const fingerprintData = JSON.stringify(components);
    const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

    return {
      machineId: request.machineId,
      fingerprint,
      components
    };
  }

  private getSubscriptionStatus(license: LicenseRecord): 'active' | 'expired' | 'cancelled' | 'grace_period' {
    if (license.status === 'revoked') return 'cancelled';

    if (license.expiresAt) {
      const now = new Date();
      const gracePeriodEnd = new Date(license.expiresAt.getTime() + (7 * 24 * 60 * 60 * 1000));

      if (now > license.expiresAt && now <= gracePeriodEnd) {
        return 'grace_period';
      } else if (now > gracePeriodEnd) {
        return 'expired';
      }
    }

    return 'active';
  }

  private getGracePeriodEnd(license: LicenseRecord): Date | undefined {
    if (license.expiresAt) {
      return new Date(license.expiresAt.getTime() + (7 * 24 * 60 * 60 * 1000));
    }
    return undefined;
  }

  private isCacheValid(cached: any, machineId: string): boolean {
    // Additional validation for cached responses
    return cached.success && cached.isValid;
  }

  private createErrorResponse(error: string, code: string): LicenseValidationResponse {
    return {
      success: false,
      isValid: false,
      tier: 'FREE',
      features: this.licenseTiers.get('FREE')!.features,
      limits: this.licenseTiers.get('FREE')!.limits,
      usage: {
        callsToday: 0,
        machinesUsed: 0,
        activeSessions: 0
      },
      subscription: {
        status: 'expired'
      },
      error,
      code
    };
  }

  private async clearLicenseCache(licenseKey: string): Promise<void> {
    // Implementation to clear specific license from cache
    // This would involve deleting from the cache table
  }

  // Public method to get tier information
  getTierInfo(tierName: string): LicenseTier | undefined {
    return this.licenseTiers.get(tierName);
  }

  getAllTiers(): LicenseTier[] {
    return Array.from(this.licenseTiers.values());
  }
}