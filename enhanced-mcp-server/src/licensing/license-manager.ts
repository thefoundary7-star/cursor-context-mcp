import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import type {
  LicenseValidationRequest,
  LicenseValidationResponse,
  LicenseTier,
  MachineFingerprint
} from './types.js';

interface LicenseConfig {
  licenseKey?: string;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  features: string[];
  limits: {
    dailyCalls: number;
    maxMachines: number;
    concurrentSessions: number;
  };
  usage: {
    callsToday: number;
    lastResetDate: string;
  };
  validationCache?: {
    lastValidated: string;
    validUntil: string;
    isValid: boolean;
  };
  machineId: string;
}

export class LicenseManager extends EventEmitter {
  private configPath: string;
  private config: LicenseConfig;
  private validationApiUrl: string;
  private machineId: string;
  private lastValidationTime: number = 0;
  private validationCacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private dailyResetInterval?: NodeJS.Timeout;
  private debugMode: boolean = false;

  // Feature definitions
  private readonly FREE_FEATURES = [
    'list_files',
    'read_file',
    'search_files',
    'get_file_stats'
  ];

  private readonly PRO_FEATURES = [
    ...this.FREE_FEATURES,
    'write_file',
    'get_file_diff',
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
  ];

  private readonly ENTERPRISE_FEATURES = [
    ...this.PRO_FEATURES,
    'team_collaboration',
    'audit_logging',
    'priority_support',
    'custom_integrations'
  ];

  constructor(validationApiUrl: string = 'http://localhost:3001/api/validate-license', debugMode: boolean = false) {
    super();
    this.validationApiUrl = validationApiUrl;
    this.debugMode = debugMode || process.env.MCP_DEBUG_MODE === 'true' || process.argv.includes('--debug-mode');
    this.machineId = this.generateMachineId();
    this.configPath = this.getConfigPath();

    // Initialize with FREE tier defaults
    this.config = {
      tier: 'FREE',
      features: this.FREE_FEATURES,
      limits: {
        dailyCalls: 50,
        maxMachines: 1,
        concurrentSessions: 1
      },
      usage: {
        callsToday: 0,
        lastResetDate: new Date().toISOString().split('T')[0]
      },
      machineId: this.machineId
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      await this.loadConfiguration();
      await this.resetDailyUsageIfNeeded();
      this.startDailyResetTimer();

      // Check for environment variable license
      const envLicense = process.env.FILEBRIDGE_LICENSE;
      if (envLicense && !this.config.licenseKey) {
        console.error('Found license in environment variable, activating...');
        await this.setLicenseKey(envLicense);
      }

      // Perform initial license validation
      await this.validateLicense();

      this.emit('initialized', {
        tier: this.config.tier,
        hasLicense: !!this.config.licenseKey,
        features: this.config.features.length
      });

      console.error(`License Manager initialized - Tier: ${this.config.tier}`);
      console.error(`Available features: ${this.config.features.length}`);
      if (this.config.licenseKey) {
        console.error(`License key: ${this.config.licenseKey.substring(0, 8)}...${this.config.licenseKey.slice(-4)}`);
      }
      console.error(`Daily usage: ${this.config.usage.callsToday}/${this.config.limits.dailyCalls === -1 ? 'unlimited' : this.config.limits.dailyCalls}`);

    } catch (error) {
      console.error('Failed to initialize License Manager:', error);
      throw error;
    }
  }

  async setLicenseKey(licenseKey: string): Promise<boolean> {
    try {
      this.config.licenseKey = licenseKey;
      await this.saveConfiguration();

      const isValid = await this.validateLicense(true);

      if (isValid) {
        this.emit('licenseActivated', {
          tier: this.config.tier,
          features: this.config.features.length
        });

        console.error(`License activated successfully! Tier: ${this.config.tier}`);
        console.error(`Unlocked ${this.config.features.length} features`);
      } else {
        // Revert to FREE if validation failed
        this.config.licenseKey = undefined;
        this.downgradeLicense();
        await this.saveConfiguration();
      }

      return isValid;
    } catch (error) {
      console.error('Error setting license key:', error);
      return false;
    }
  }

  async checkFeatureAccess(featureName: string): Promise<{ allowed: boolean; reason?: string }> {
    // DISABLE_LICENSE: Bypass all license validation
    if (process.env.DISABLE_LICENSE === 'true') {
      console.error(`[DISABLE_LICENSE] License check bypassed for '${featureName}' - licensing disabled`);
      return { allowed: true };
    }

    // DEBUG MODE: Allow all features without restrictions
    if (this.debugMode) {
      console.error(`[DEBUG] License check bypassed for '${featureName}' - debug mode enabled`);
      return { allowed: true };
    }

    // Reset daily usage if needed
    await this.resetDailyUsageIfNeeded();

    // Check if feature is in the allowed list
    if (!this.config.features.includes(featureName)) {
      return {
        allowed: false,
        reason: `Feature '${featureName}' requires ${this.getRequiredTierForFeature(featureName)} tier. Current tier: ${this.config.tier}`
      };
    }

    // Check daily usage limits (not for unlimited tiers)
    if (this.config.limits.dailyCalls !== -1 && this.config.usage.callsToday >= this.config.limits.dailyCalls) {
      return {
        allowed: false,
        reason: `Daily usage limit reached (${this.config.limits.dailyCalls} calls). Resets at midnight or upgrade to PRO for unlimited usage.`
      };
    }

    // Validate license periodically (every 5 minutes)
    const now = Date.now();
    if (now - this.lastValidationTime > this.validationCacheTTL) {
      await this.validateLicense();
    }

    return { allowed: true };
  }

  async recordUsage(featureName: string): Promise<void> {
    await this.resetDailyUsageIfNeeded();

    this.config.usage.callsToday++;
    await this.saveConfiguration();

    this.emit('usageRecorded', {
      feature: featureName,
      callsToday: this.config.usage.callsToday,
      limit: this.config.limits.dailyCalls
    });

    // Warn when approaching limit
    if (this.config.limits.dailyCalls !== -1) {
      const remaining = this.config.limits.dailyCalls - this.config.usage.callsToday;
      if (remaining <= 5 && remaining > 0) {
        console.error(`WARNING: Only ${remaining} API calls remaining today. Consider upgrading to PRO for unlimited usage.`);
      }
    }
  }

  getStatus(): {
    tier: string;
    hasLicense: boolean;
    features: number;
    usage: { callsToday: number; limit: number };
    subscription: any;
  } {
    // If licensing is disabled, always return PRO tier status
    if (process.env.DISABLE_LICENSE === 'true') {
      return {
        tier: 'PRO',
        hasLicense: true,
        features: this.PRO_FEATURES.length,
        usage: {
          callsToday: 0,
          limit: -1 // unlimited
        },
        subscription: { status: 'active', disabled: true }
      };
    }

    return {
      tier: this.config.tier,
      hasLicense: !!this.config.licenseKey,
      features: this.config.features.length,
      usage: {
        callsToday: this.config.usage.callsToday,
        limit: this.config.limits.dailyCalls
      },
      subscription: this.config.validationCache || null
    };
  }

  async showUpgradePrompt(featureName: string): Promise<void> {
    const requiredTier = this.getRequiredTierForFeature(featureName);

    console.error('\nPremium Feature Locked');
    console.error(`Feature '${featureName}' requires ${requiredTier} tier.`);
    console.error(`Current tier: ${this.config.tier}`);
    console.error('\nUpgrade Benefits:');

    if (requiredTier === 'PRO') {
      console.error('  * 26+ advanced features');
      console.error('  * Unlimited API calls');
      console.error('  * Code navigation & refactoring');
      console.error('  * Test framework integration');
      console.error('  * Performance monitoring');
      console.error('  * Only $29/month');
    }

    console.error('\nGet your license at: https://filebridge.dev/pricing');
    console.error('Questions? Contact support@filebridge.dev\n');
  }

  private async validateLicense(force: boolean = false): Promise<boolean> {
    try {
      // DISABLE_LICENSE: Always return valid PRO tier
      if (process.env.DISABLE_LICENSE === 'true') {
        console.error('[DISABLE_LICENSE] License validation bypassed - returning PRO tier');
        this.config.tier = 'PRO';
        this.config.features = this.PRO_FEATURES;
        this.config.limits = this.getLimitsForTier('PRO');
        return true;
      }

      // Use cached validation if available and not forced
      if (!force && this.isCacheValid()) {
        return this.config.validationCache!.isValid;
      }

      // No license key means FREE tier
      if (!this.config.licenseKey) {
        this.downgradeLicense();
        return true; // FREE tier is always valid
      }

      const validationRequest: LicenseValidationRequest = {
        licenseKey: this.config.licenseKey,
        machineId: this.machineId,
        features: this.config.features,
        version: this.getVersion()
      };

      const response = await this.performLicenseValidation(validationRequest);

      if (response.success && response.isValid) {
        this.updateLicenseFromValidation(response);
        this.lastValidationTime = Date.now();
        return true;
      } else {
        console.error('License validation failed:', response.error);
        this.downgradeLicense();
        return false;
      }

    } catch (error) {
      console.error('License validation error:', error);

      // Use cached validation if available during network errors
      if (this.config.validationCache && this.isCacheValid()) {
        console.error('Using cached validation due to network error');
        return this.config.validationCache.isValid;
      }

      // Graceful degradation - continue with current configuration
      return this.config.tier === 'FREE';
    }
  }

  private async performLicenseValidation(request: LicenseValidationRequest): Promise<LicenseValidationResponse> {
    // This would make an HTTP request to the license validation API
    // For demo purposes, we'll simulate the request

    console.error(`Validating license: ${request.licenseKey.substring(0, 8)}...`);

    try {
      // In real implementation, this would be an HTTP request:
      // const response = await fetch(this.validationApiUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(request)
      // });
      // return await response.json();

      // Simulate API response based on license key format
      if (this.isValidLicenseFormat(request.licenseKey)) {
        const tier = this.extractTierFromLicenseKey(request.licenseKey);
        return {
          success: true,
          isValid: true,
          tier,
          features: this.getFeaturesForTier(tier),
          limits: this.getLimitsForTier(tier),
          usage: {
            callsToday: this.config.usage.callsToday,
            machinesUsed: 1,
            activeSessions: 1
          },
          subscription: {
            status: 'active'
          }
        };
      } else {
        return {
          success: false,
          isValid: false,
          tier: 'FREE',
          features: this.FREE_FEATURES,
          limits: { dailyCalls: 50, maxMachines: 1, concurrentSessions: 1 },
          usage: { callsToday: 0, machinesUsed: 0, activeSessions: 0 },
          subscription: { status: 'expired' },
          error: 'Invalid license key format',
          code: 'INVALID_FORMAT'
        };
      }
    } catch (error) {
      throw new Error(`License validation failed: ${error}`);
    }
  }

  private updateLicenseFromValidation(response: LicenseValidationResponse): void {
    this.config.tier = response.tier;
    this.config.features = response.features;
    this.config.limits = response.limits;

    // Update validation cache
    this.config.validationCache = {
      lastValidated: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      isValid: response.isValid
    };

    this.saveConfiguration().catch(console.error);

    this.emit('licenseUpdated', {
      tier: this.config.tier,
      features: this.config.features.length,
      subscription: response.subscription
    });
  }

  private downgradeLicense(): void {
    this.config.tier = 'FREE';
    this.config.features = this.FREE_FEATURES;
    this.config.limits = {
      dailyCalls: 50,
      maxMachines: 1,
      concurrentSessions: 1
    };

    this.emit('licenseDowngraded', {
      tier: this.config.tier,
      features: this.config.features.length
    });

    console.error('Downgraded to FREE tier');
  }

  private isCacheValid(): boolean {
    if (!this.config.validationCache) return false;

    const validUntil = new Date(this.config.validationCache.validUntil);
    return new Date() < validUntil;
  }

  private isValidLicenseFormat(licenseKey: string): boolean {
    // Basic format validation: PRO-TIMESTAMP-USERHASH-RANDOM-CHECKSUM
    const pattern = /^(FREE|PRO|ENT)-[A-Z0-9]+-[A-F0-9]{8}-[A-F0-9]{16}-[A-F0-9]{4}$/;
    return pattern.test(licenseKey);
  }

  private extractTierFromLicenseKey(licenseKey: string): 'FREE' | 'PRO' | 'ENTERPRISE' {
    const prefix = licenseKey.split('-')[0];
    switch (prefix) {
      case 'PRO': return 'PRO';
      case 'ENT': return 'ENTERPRISE';
      default: return 'FREE';
    }
  }

  private getFeaturesForTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): string[] {
    switch (tier) {
      case 'PRO': return this.PRO_FEATURES;
      case 'ENTERPRISE': return this.ENTERPRISE_FEATURES;
      default: return this.FREE_FEATURES;
    }
  }

  private getLimitsForTier(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): { dailyCalls: number; maxMachines: number; concurrentSessions: number } {
    switch (tier) {
      case 'PRO':
        return { dailyCalls: -1, maxMachines: 3, concurrentSessions: 5 };
      case 'ENTERPRISE':
        return { dailyCalls: -1, maxMachines: 10, concurrentSessions: 20 };
      default:
        return { dailyCalls: 50, maxMachines: 1, concurrentSessions: 1 };
    }
  }

  private getRequiredTierForFeature(featureName: string): string {
    if (this.ENTERPRISE_FEATURES.includes(featureName) && !this.PRO_FEATURES.includes(featureName)) {
      return 'ENTERPRISE';
    }
    if (this.PRO_FEATURES.includes(featureName) && !this.FREE_FEATURES.includes(featureName)) {
      return 'PRO';
    }
    return 'FREE';
  }

  private generateMachineId(): string {
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();
    const userInfo = os.userInfo();

    const components = `${platform}-${arch}-${hostname}-${userInfo.username}`;
    return crypto.createHash('sha256').update(components).digest('hex').substring(0, 32);
  }

  private getConfigPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.filebridge', 'config.json');
  }

  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const savedConfig = JSON.parse(configData);

      // Merge with defaults
      this.config = {
        ...this.config,
        ...savedConfig
      };

      // Ensure machine ID consistency
      if (this.config.machineId !== this.machineId) {
        this.config.machineId = this.machineId;
        await this.saveConfiguration();
      }

    } catch (error) {
      // Config file doesn't exist or is corrupted, use defaults
      await this.saveConfiguration();
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  private async resetDailyUsageIfNeeded(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    if (this.config.usage.lastResetDate !== today) {
      this.config.usage.callsToday = 0;
      this.config.usage.lastResetDate = today;
      await this.saveConfiguration();

      this.emit('dailyReset', {
        date: today,
        tier: this.config.tier
      });

      console.error('Daily usage counter reset');
    }
  }

  private startDailyResetTimer(): void {
    // Calculate time until midnight
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Set timer for midnight
    setTimeout(() => {
      this.resetDailyUsageIfNeeded();

      // Set interval for every 24 hours
      this.dailyResetInterval = setInterval(() => {
        this.resetDailyUsageIfNeeded();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  private getVersion(): string {
    // Get version from package.json or environment
    return process.env.npm_package_version || '2.1.0';
  }

  async cleanup(): Promise<void> {
    if (this.dailyResetInterval) {
      clearInterval(this.dailyResetInterval);
    }
  }

  // CLI helper methods
  async setupInteractive(): Promise<boolean> {
    console.error('\nFileBridge License Setup');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.error('\nCurrent Status:');
    console.error(`   Tier: ${this.config.tier}`);
    console.error(`   Features: ${this.config.features.length}`);
    console.error(`   Daily Usage: ${this.config.usage.callsToday}/${this.config.limits.dailyCalls === -1 ? '∞' : this.config.limits.dailyCalls}`);

    if (!this.config.licenseKey) {
      console.error('\nNo license key found. You\'re currently using the FREE tier.');
      console.error('   Get your PRO license at: https://filebridge.dev/pricing');
      console.error('\nTo activate a license, use: enhanced-mcp-server --license YOUR_LICENSE_KEY');
      return false;
    }

    return true;
  }

  getFeaturePreview(featureName: string): string {
    const previews: { [key: string]: string } = {
      'write_file': 'Edit and create files directly from Claude',
      'search_symbols': 'Find functions, classes, and variables across your codebase',
      'run_tests': 'Execute your test suite with detailed results',
      'git_diff': 'Advanced git diff with context and formatting',
      'security_scan': 'Scan your code for security vulnerabilities',
      'refactor_suggestions': 'Get intelligent code refactoring recommendations'
    };

    return previews[featureName] || `${featureName} - Available in PRO tier`;
  }
}