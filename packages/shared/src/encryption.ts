import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Encrypts a string using AES-256-GCM
 */
export async function encrypt(text: string, key: string): Promise<string> {
  const algorithm = 'aes-256-gcm';
  const iv = randomBytes(16);
  
  // Derive key from password
  const keyBuffer = await scryptAsync(key, 'salt', 32) as Buffer;
  
  const cipher = createCipheriv(algorithm, keyBuffer, iv);
  cipher.setAAD(Buffer.from('unifiedcron'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine iv, authTag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts a string using AES-256-GCM
 */
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  const algorithm = 'aes-256-gcm';
  
  // Split the encrypted text
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  // Derive key from password
  const keyBuffer = await scryptAsync(key, 'salt', 32) as Buffer;
  
  const decipher = createDecipheriv(algorithm, keyBuffer, iv);
  decipher.setAAD(Buffer.from('unifiedcron'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Masks sensitive data for logging
 */
export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (!secret || secret.length <= visibleChars) {
    return '*'.repeat(8);
  }
  
  const visible = secret.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(secret.length - visibleChars, 4));
  
  return masked + visible;
}

/**
 * Generates a secure encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}
