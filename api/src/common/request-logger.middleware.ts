import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TelemetryService } from '../dashboard/telemetry.service';
import * as crypto from 'crypto';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly telemetryService: TelemetryService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, headers } = req;

    // 1. Resolve or generate Journey ID and Reference ID
    const journeyId =
      (headers['x-journey-id'] as string) ||
      `jrn_${crypto.randomBytes(6).toString('hex')}`;

    const referenceId =
      (headers['x-reference-id'] as string) ||
      (headers['cf-ray'] as string) ||
      `ref_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    // 2. Attach tracking headers to response for full client-to-server traceability
    res.setHeader('x-journey-id', journeyId);
    res.setHeader('x-reference-id', referenceId);

    // 3. Extract rich user telemetry
    const realIp =
      (headers['cf-connecting-ip'] as string) ||
      (headers['x-real-ip'] as string) ||
      (headers['x-forwarded-for'] ? (headers['x-forwarded-for'] as string).split(',')[0].trim() : req.ip || '127.0.0.1');

    const userIp = req.socket?.remoteAddress || req.ip || realIp;
    const country = (headers['cf-ipcountry'] as string) || 'LOCAL';
    const city = (headers['cf-ipcity'] as string) || '';
    const region = (headers['cf-region'] as string) || '';
    const userLocation = city ? `${city}, ${region ? region + ', ' : ''}${country}` : country;

    const userDeviceId =
      (headers['x-device-id'] as string) ||
      (headers['sec-ch-ua-platform'] ? `${(headers['sec-ch-ua-platform'] as string).replace(/"/g, '')}` : undefined);

    const cfRay = (headers['cf-ray'] as string) || referenceId;
    const userAgent = (headers['user-agent'] as string) || 'Unknown';

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const { statusCode } = res;

      // Record to live telemetry (filter out internal health checks, polling endpoints, and static noise)
      const cleanPath = (originalUrl || '').split('?')[0].toLowerCase();
      const isHealthOrNoise =
        cleanPath === '/health' ||
        cleanPath === '/api/health' ||
        cleanPath.endsWith('/health') ||
        cleanPath.includes('system-health') ||
        cleanPath.includes('nginx-health') ||
        cleanPath.startsWith('/dashboard/metrics') ||
        cleanPath.startsWith('/api/dashboard/metrics') ||
        cleanPath.startsWith('/dashboard/stream') ||
        cleanPath.startsWith('/api/dashboard/stream') ||
        cleanPath === '/favicon.ico';

      if (!isHealthOrNoise) {
        this.telemetryService.recordRequest({
          journeyId,
          referenceId,
          method,
          url: originalUrl,
          statusCode,
          durationMs,
          userIp,
          realIp,
          country,
          userLocation,
          userDeviceId,
          cfRay,
          userAgent,
        });
      }
    });

    next();
  }
}
