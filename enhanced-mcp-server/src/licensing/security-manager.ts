import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import type { SecurityConfig, MachineFingerprint } from './types.js';

export class SecurityManager {
  private config: SecurityConfig;

  constructor(config?: SecurityConfig) {
    this.config = config || this.getDefaultConfig();
  }

  private getDefaultConfig(): SecurityConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || this.generateSecureKey(),
      encryptionKey: process.env.ENCRYPTION_KEY || this.generateSecureKey(),
      webhookSecret: process.env.WEBHOOK_SECRET || this.generateSecureKey(),
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      rateLimits: {
        validation: parseInt(process.env.RATE_LIMIT_VALIDATION || '20'),
        generation: parseInt(process.env.RATE_LIMIT_GENERATION || '5'),
        webhook: parseInt(process.env.RATE_LIMIT_WEBHOOK || '10')
      }
    };
  }

  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // License Key Security
  encryptLicenseKey(plainKey: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.config.encryptionKey);

    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decryptLicenseKey(encryptedKey: string): string {
    const algorithm = 'aes-256-gcm';
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, this.config.encryptionKey);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // License Key Validation
  validateLicenseKeyFormat(licenseKey: string): boolean {
    // Expected format: PRO-TIMESTAMP-USERHASH-RANDOM-CHECKSUM
    const pattern = /^(FREE|PRO|ENT)-[A-Z0-9]+-[A-F0-9]{8}-[A-F0-9]{16}-[A-F0-9]{4}$/;

    if (!pattern.test(licenseKey)) {
      return false;
    }

    // Validate checksum
    const parts = licenseKey.split('-');
    const keyWithoutChecksum = parts.slice(0, -1).join('-');
    const providedChecksum = parts[parts.length - 1];
    const calculatedChecksum = crypto.createHash('sha256')
      .update(keyWithoutChecksum)
      .digest('hex')
      .substring(0, 4)
      .toUpperCase();

    return providedChecksum === calculatedChecksum;
  }

  // Machine Fingerprinting Security
  generateSecureMachineFingerprint(components: any): MachineFingerprint {
    // Add additional security components
    const secureComponents = {
      ...components,
      timestamp: Date.now(),
      salt: crypto.randomBytes(16).toString('hex')
    };

    const fingerprintData = JSON.stringify(secureComponents);
    const fingerprint = crypto.createHash('sha256')
      .update(fingerprintData + this.config.encryptionKey)
      .digest('hex');

    return {
      machineId: components.machineId || components.platform + '-' + components.arch,
      fingerprint,
      components: secureComponents
    };
  }

  validateMachineFingerprint(stored: string, current: MachineFingerprint): boolean {
    // Allow some tolerance for minor system changes
    const storedComponents = JSON.parse(stored);
    const currentComponents = current.components;

    // Core components that must match exactly
    const coreMatches = [
      storedComponents.platform === currentComponents.platform,
      storedComponents.arch === currentComponents.arch,
      storedComponents.machineId === currentComponents.machineId
    ];

    return coreMatches.every(match => match);
  }

  // JWT Token Management
  generateAccessToken(payload: any, expiresIn: string = '1h'): string {
    return jwt.sign(payload, this.config.jwtSecret, { expiresIn } as jwt.SignOptions);
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.config.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Request Signing (for API requests)
  signRequest(payload: any, timestamp: number): string {
    const data = JSON.stringify(payload) + timestamp.toString();
    return crypto.createHmac('sha256', this.config.encryptionKey)
      .update(data)
      .digest('hex');
  }

  verifyRequestSignature(payload: any, timestamp: number, signature: string): boolean {
    const expectedSignature = this.signRequest(payload, timestamp);

    // Prevent timing attacks
    const providedBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  }

  // Webhook Security
  generateWebhookSignature(payload: string): string {
    return crypto.createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = this.generateWebhookSignature(payload);
    const providedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  }

  // Anti-Tampering
  generateIntegrityHash(data: any): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256')
      .update(dataString + this.config.encryptionKey)
      .digest('hex');
  }

  verifyIntegrity(data: any, hash: string): boolean {
    const calculatedHash = this.generateIntegrityHash(data);
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  // Rate Limiting Helper
  generateRateLimitKey(ip: string, endpoint: string): string {
    return crypto.createHash('sha256')
      .update(`${ip}:${endpoint}:${this.config.encryptionKey}`)
      .digest('hex')
      .substring(0, 16);
  }

  // IP Address Validation
  isValidIPAddress(ip: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
  }

  // Secure Random Generation
  generateSecureRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSecureRandomNumber(min: number = 0, max: number = 1000000): number {
    const range = max - min + 1;
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    return min + (randomValue % range);
  }

  // Password/Secret Hashing
  hashSecret(secret: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(secret, actualSalt, 100000, 64, 'sha256').toString('hex');

    return { hash, salt: actualSalt };
  }

  verifySecret(secret: string, hash: string, salt: string): boolean {
    const calculatedHash = crypto.pbkdf2Sync(secret, salt, 100000, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  // License Obfuscation (for client-side storage)
  obfuscateLicenseData(data: any): string {
    const jsonData = JSON.stringify(data);
    const encrypted = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    let obfuscated = encrypted.update(jsonData, 'utf8', 'hex');
    obfuscated += encrypted.final('hex');

    // Add some noise to prevent pattern recognition
    const noise = crypto.randomBytes(8).toString('hex');
    return noise + obfuscated;
  }

  deobfuscateLicenseData(obfuscatedData: string): any {
    try {
      // Remove noise
      const actualData = obfuscatedData.substring(16);

      const decrypted = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
      let jsonData = decrypted.update(actualData, 'hex', 'utf8');
      jsonData += decrypted.final('utf8');

      return JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid or corrupted license data');
    }
  }

  // Security Audit Logging
  logSecurityEvent(event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity,
      hash: this.generateIntegrityHash({ event, details, timestamp: Date.now() })
    };

    // In production, this should go to a secure logging service
    console.log(`[SECURITY-${severity.toUpperCase()}]`, JSON.stringify(logEntry));
  }

  // Environment Security Check
  validateEnvironmentSecurity(): { secure: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!process.env.JWT_SECRET) {
      issues.push('JWT_SECRET environment variable not set');
    }

    if (!process.env.ENCRYPTION_KEY) {
      issues.push('ENCRYPTION_KEY environment variable not set');
    }

    if (!process.env.WEBHOOK_SECRET) {
      issues.push('WEBHOOK_SECRET environment variable not set');
    }

    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
      issues.push('NODE_ENV should be set to production or staging');
    }

    return {
      secure: issues.length === 0,
      issues
    };
  }
}