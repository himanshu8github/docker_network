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

  // Generate Signed Crypto Token (HMAC-SHA256)
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

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  // Verify & Decode Crypto Token
  verifyToken(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token structure');
    }

    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw new UnauthorizedException('Invalid token signature');
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);

    if (payload.exp < nowSec) {
      throw new UnauthorizedException('Token has expired');
    }

    return payload;
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
