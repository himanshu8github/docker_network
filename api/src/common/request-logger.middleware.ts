import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TelemetryService } from '../dashboard/telemetry.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly telemetryService: TelemetryService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, headers } = req;

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const { statusCode } = res;

      const clientIp =
        (headers['cf-connecting-ip'] as string) ||
        (headers['x-real-ip'] as string) ||
        (headers['x-forwarded-for'] ? (headers['x-forwarded-for'] as string).split(',')[0].trim() : '127.0.0.1');

      const country = (headers['cf-ipcountry'] as string) || 'LOCAL';
      const cfRay = (headers['cf-ray'] as string) || 'direct';
      const userAgent = (headers['user-agent'] as string) || 'Unknown';

      // Record to live telemetry (skip telemetry polling itself to avoid noise)
      if (!originalUrl.startsWith('/dashboard/metrics') && !originalUrl.startsWith('/dashboard/stream')) {
        this.telemetryService.recordRequest({
          method,
          url: originalUrl,
          statusCode,
          durationMs,
          clientIp,
          country,
          cfRay,
          userAgent,
        });
      }
    });

    next();
  }
}
