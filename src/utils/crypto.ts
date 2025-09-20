import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload } from '@/types';
import { jwtConfig } from './config';

// Password hashing
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// JWT token generation
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    issuer: 'mcp-saas-backend',
    audience: 'mcp-saas-client',
  });
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
    issuer: 'mcp-saas-backend',
    audience: 'mcp-saas-client',
  });
};

// JWT token verification
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, jwtConfig.secret, {
      issuer: 'mcp-saas-backend',
      audience: 'mcp-saas-client',
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    } else if (error instanceof jwt.NotBeforeError) {
      throw new Error('Access token not active');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, jwtConfig.refreshSecret, {
      issuer: 'mcp-saas-backend',
      audience: 'mcp-saas-client',
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    } else if (error instanceof jwt.NotBeforeError) {
      throw new Error('Refresh token not active');
    } else {
      throw new Error('Refresh token verification failed');
    }
  }
};

// License key generation
export const generateLicenseKey = (): string => {
  const prefix = 'MCP';
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${randomBytes}`;
};

// API key generation
export const generateApiKey = (): string => {
  const prefix = 'mcp_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
};

// Hash API key for storage
export const hashApiKey = (apiKey: string): string => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

// Generate random string
export const generateRandomString = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate secure random number
export const generateSecureRandom = (min: number = 0, max: number = 1000000): number => {
  const range = max - min;
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0);
  return min + (randomValue % range);
};

// Encrypt sensitive data
export const encrypt = (text: string, secretKey: string): string => {
  try {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const cipher = crypto.createCipherGCM(algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid encryption parameters');
    } else if (error instanceof RangeError) {
      throw new Error('Encryption data size error');
    } else {
      throw new Error('Encryption failed');
    }
  }
};

// Decrypt sensitive data
export const decrypt = (encryptedText: string, secretKey: string): string => {
  try {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = crypto.scryptSync(secretKey, 'salt', 32);

    const decipher = crypto.createDecipherGCM(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid encrypted text format')) {
      throw error;
    } else if (error instanceof TypeError) {
      throw new Error('Invalid decryption parameters');
    } else if (error instanceof Error && error.message.includes('Unsupported state')) {
      throw new Error('Invalid authentication tag');
    } else {
      throw new Error('Decryption failed');
    }
  }
};

// Generate HMAC signature
export const generateHmacSignature = (data: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// Verify HMAC signature with timing attack protection
export const verifyHmacSignature = (data: string, signature: string, secret: string): boolean => {
  try {
    const expectedSignature = generateHmacSignature(data, secret);

    // Normalize signature lengths to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    // Log suspicious activity but don't reveal details
    return false;
  }
};

// Generate UUID v4
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

// Hash function for consistent hashing
export const hash = (input: string, algorithm: string = 'sha256'): string => {
  try {
    return crypto.createHash(algorithm).update(input).digest('hex');
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid hash algorithm or input');
    } else {
      throw new Error('Hashing failed');
    }
  }
};

// Generate hardware fingerprint for license validation
export const generateHardwareFingerprint = (): string => {
  try {
    const os = require('os');
    const fingerprint = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalmem: Math.floor(os.totalmem() / (1024 * 1024 * 1024)), // GB
      hostname: os.hostname(),
    };

    const fingerprintString = JSON.stringify(fingerprint);
    return hash(fingerprintString);
  } catch (error) {
    throw new Error('Failed to generate hardware fingerprint');
  }
};

// Generate digital signature for license tampering detection
export const generateDigitalSignature = (data: string, privateKey: string): string => {
  try {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  } catch (error) {
    if (error instanceof Error && error.message.includes('key')) {
      throw new Error('Invalid private key for signing');
    } else {
      throw new Error('Digital signature generation failed');
    }
  }
};

// Verify digital signature
export const verifyDigitalSignature = (data: string, signature: string, publicKey: string): boolean => {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  } catch (error) {
    // Don't reveal details about verification errors
    return false;
  }
};

// Secure random token for MFA
export const generateMfaToken = (length: number = 6): string => {
  try {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      result += digits[randomIndex];
    }
    return result;
  } catch (error) {
    throw new Error('Failed to generate MFA token');
  }
};

// Generate secure backup codes for MFA
export const generateBackupCodes = (count: number = 10): string[] => {
  try {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
      codes.push(formattedCode);
    }
    return codes;
  } catch (error) {
    throw new Error('Failed to generate backup codes');
  }
};
