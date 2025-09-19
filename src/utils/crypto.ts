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
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, jwtConfig.refreshSecret, {
      issuer: 'mcp-saas-backend',
      audience: 'mcp-saas-client',
    }) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
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
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secretKey);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

// Decrypt sensitive data
export const decrypt = (encryptedText: string, secretKey: string): string => {
  const algorithm = 'aes-256-gcm';
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipher(algorithm, secretKey);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Generate HMAC signature
export const generateHmacSignature = (data: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// Verify HMAC signature
export const verifyHmacSignature = (data: string, signature: string, secret: string): boolean => {
  const expectedSignature = generateHmacSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

// Generate UUID v4
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

// Hash function for consistent hashing
export const hash = (input: string, algorithm: string = 'sha256'): string => {
  return crypto.createHash(algorithm).update(input).digest('hex');
};
