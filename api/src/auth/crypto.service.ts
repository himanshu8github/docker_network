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
  verifyPassword(password: string, storedHash?: string): boolean {
    if (!password || !storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
      return false;
    }
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    try {
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }

  // 32-byte AES-256 encryption key derived deterministically from secret
  private getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(this.secret).digest();
  }

  // Generate Standard JWT (Header + Encrypted Payload + Signature)
  // 1. Header: Standard {"alg":"HS256","typ":"JWT"}
  // 2. Payload: JSON object containing { "enc": "<AES-256-GCM encrypted claims>", "exp": <timestamp> }
  //    -> Valid JSON so jwt.io parses without header/payload errors!
  //    -> Sensitive claims (email, username, role, sub) are encrypted with AES-256-GCM so NOBODY can decrypt on jwt.io without server secret key!
  // 3. Signature: HMAC-SHA256(header.payload, secret)
  generateToken(
    user: { id: number; email: string; username: string; role: 'admin' | 'user' },
    expiresInSeconds: number,
  ): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + expiresInSeconds;

    const claims = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      dateOfLogin: new Date().toISOString(),
      exp,
    };

    // Encrypt claims using AES-256-GCM
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(claims), 'utf8', 'base64url');
    ciphertext += cipher.final('base64url');
    const authTag = cipher.getAuthTag().toString('base64url');
    const encryptedData = `${iv.toString('base64url')}.${ciphertext}.${authTag}`;

    // Standard 3-Part JWT: Header . Payload . Signature
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        enc: encryptedData,
        exp,
      }),
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  // Verify & Decrypt Token (Supports Header + Encrypted Payload + Signature)
  verifyToken(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token structure');
    }

    const [part1, part2, part3] = parts;
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Standard JWT with Encrypted Payload (header.payload.signature)
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(`${part1}.${part2}`)
        .digest('base64url');

      if (
        part3.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(part3), Buffer.from(expectedSignature))
      ) {
        const parsedBody = JSON.parse(Buffer.from(part2, 'base64url').toString('utf8'));

        // If payload has encrypted 'enc' field (AES-256-GCM)
        if (parsedBody.enc) {
          const encParts = parsedBody.enc.split('.');
          if (encParts.length === 3) {
            const [ivStr, ciphertext, tagStr] = encParts;
            const iv = Buffer.from(ivStr, 'base64url');
            const authTag = Buffer.from(tagStr, 'base64url');
            const key = this.getEncryptionKey();

            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(ciphertext, 'base64url', 'utf8');
            decrypted += decipher.final('utf8');

            const payload: TokenPayload = JSON.parse(decrypted);
            if (payload.exp < nowSec) {
              throw new UnauthorizedException('Token has expired');
            }
            return payload;
          }
        }

        // Fallback for unencrypted legacy payload
        if (parsedBody.exp && parsedBody.exp < nowSec) {
          throw new UnauthorizedException('Token has expired');
        }
        if (parsedBody.sub && parsedBody.email) {
          return parsedBody as TokenPayload;
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
    }

    // 2. Direct AES-256-GCM Encrypted Token (iv.ciphertext.authTag)
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
      if (err instanceof UnauthorizedException) throw err;
    }

    throw new UnauthorizedException('Invalid or unauthenticated token');
  }

  // Generate Refresh Token with AES-256-GCM encrypted claims inside standard JWT
  generateRefreshTokenString(user?: { id?: number; role?: string }): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + 2 * 24 * 60 * 60; // 2 days

    const refreshClaims = {
      sub: user?.id || 0,
      role: user?.role || 'user',
      type: 'refresh',
      jti: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
      exp,
    };

    // Encrypt refresh claims using AES-256-GCM
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(refreshClaims), 'utf8', 'base64url');
    ciphertext += cipher.final('base64url');
    const authTag = cipher.getAuthTag().toString('base64url');
    const encryptedData = `${iv.toString('base64url')}.${ciphertext}.${authTag}`;

    // Standard JWT: Header . Payload . Signature
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        enc: encryptedData,
        exp,
      }),
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  // Hash refresh token for DB storage
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
