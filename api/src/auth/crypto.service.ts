import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TokenPayload {
  sub: number; // userId
  email: string;
  username: string;
  role: 'admin' | 'user';
  dateOfLogin: string;
  exp: number; // expiration timestamp in seconds
}

@Injectable()
export class CryptoService {
  private readonly secret = process.env.JWT_SECRET || 'cloudops_secure_crypto_secret_key_2026';

  // Secure Password Hashing with Salt
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  // Verify Password
  verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  }

  // 32-byte AES-256 encryption key derived deterministically from secret
  private getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(this.secret).digest();
  }

  // Generate AES-256-GCM Authenticated Encrypted Token
  // Format: <iv_base64url>.<ciphertext_base64url>.<authTag_base64url>
  // Without the secret key, nobody can decrypt or inspect the claims inside (e.g. on jwt.io)
  generateToken(
    user: { id: number; email: string; username: string; role: 'admin' | 'user' },
    expiresInSeconds: number,
  ): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      dateOfLogin: new Date().toISOString(),
      exp: nowSec + expiresInSeconds,
    };

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(JSON.stringify(payload), 'utf8', 'base64url');
    ciphertext += cipher.final('base64url');
    const authTag = cipher.getAuthTag().toString('base64url');
    const ivStr = iv.toString('base64url');

    return `${ivStr}.${ciphertext}.${authTag}`;
  }

  // Verify & Decrypt Crypto Token (AES-256-GCM with backward compatibility for legacy tokens)
  verifyToken(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token structure');
    }

    const [part1, part2, part3] = parts;
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Attempt AES-256-GCM Decryption (Primary encrypted format)
    try {
      const iv = Buffer.from(part1, 'base64url');
      const authTag = Buffer.from(part3, 'base64url');

      if (iv.length === 16 && authTag.length === 16) {
        const key = this.getEncryptionKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(part2, 'base64url', 'utf8');
        decrypted += decipher.final('utf8');

        const payload: TokenPayload = JSON.parse(decrypted);
        if (payload.exp < nowSec) {
          throw new UnauthorizedException('Token has expired');
        }
        return payload;
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      // If AES decryption failed, proceed to test legacy HMAC fallback
    }

    // 2. Legacy Fallback: HMAC-SHA256 Signed Token
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(`${part1}.${part2}`)
        .digest('base64url');

      if (
        part3.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(part3), Buffer.from(expectedSignature))
      ) {
        const payload: TokenPayload = JSON.parse(Buffer.from(part2, 'base64url').toString('utf8'));
        if (payload.exp < nowSec) {
          throw new UnauthorizedException('Token has expired');
        }
        return payload;
      }
    } catch {
      // Legacy fallback also failed
    }

    throw new UnauthorizedException('Invalid or unauthenticated token');
  }

  // Generate random refresh token string
  generateRefreshTokenString(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  // Hash refresh token for DB storage
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
