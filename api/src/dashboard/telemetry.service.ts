import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestLog } from './request-log.entity';

export interface RequestLogEntry {
  id: number | string;
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  clientIp: string;
  country: string;
  cfRay: string;
  userAgent: string;
}

@Injectable()
export class TelemetryService implements OnModuleInit {
  constructor(
    @InjectRepository(RequestLog)
    private readonly requestLogRepository: Repository<RequestLog>,
  ) {}

  // Live counters backed by MySQL
  public counters = {
    totalRequests: 0,
    getRequests: 0,
    postRequests: 0,
    patchRequests: 0,
    deleteRequests: 0,
    status2xx: 0,
    status4xx: 0,
    status5xx: 0,
  };

  async onModuleInit() {
    try {
      this.counters.totalRequests = await this.requestLogRepository.count();
      this.counters.getRequests = await this.requestLogRepository.count({ where: { method: 'GET' } });
      this.counters.postRequests = await this.requestLogRepository.count({ where: { method: 'POST' } });
      this.counters.deleteRequests = await this.requestLogRepository.count({ where: { method: 'DELETE' } });
    } catch {
      // Pending table readiness
    }
  }

  async recordRequest(entry: Omit<RequestLogEntry, 'id' | 'timestamp'>) {
    this.counters.totalRequests++;

    const methodUpper = entry.method.toUpperCase();
    if (methodUpper === 'GET') this.counters.getRequests++;
    else if (methodUpper === 'POST') this.counters.postRequests++;
    else if (methodUpper === 'PATCH' || methodUpper === 'PUT') this.counters.patchRequests++;
    else if (methodUpper === 'DELETE') this.counters.deleteRequests++;

    if (entry.statusCode >= 200 && entry.statusCode < 300) this.counters.status2xx++;
    else if (entry.statusCode >= 400 && entry.statusCode < 500) this.counters.status4xx++;
    else if (entry.statusCode >= 500) this.counters.status5xx++;

    try {
      const log = this.requestLogRepository.create({
        method: entry.method,
        url: entry.url,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        clientIp: entry.clientIp,
        country: entry.country,
        cfRay: entry.cfRay,
        userAgent: entry.userAgent,
      });
      await this.requestLogRepository.save(log);
    } catch (err) {
      console.warn('[Telemetry] Error saving request log to MySQL:', err.message);
    }
  }

  async getRecentLogs(limit = 10, page = 1) {
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    const p = Math.max(1, Number(page) || 1);
    const skip = (p - 1) * l;

    try {
      const [logs, total] = await this.requestLogRepository.findAndCount({
        order: { createdAt: 'DESC' },
        skip,
        take: l,
      });

      return {
        items: logs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt ? log.createdAt.toISOString() : new Date().toISOString(),
          method: log.method,
          url: log.url,
          statusCode: log.statusCode,
          durationMs: log.durationMs,
          clientIp: log.clientIp,
          country: log.country,
          cfRay: log.cfRay,
          userAgent: log.userAgent,
        })),
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1,
      };
    } catch (err) {
      console.warn('[Telemetry] Error fetching recent logs:', err.message);
      return { items: [], total: 0, page: 1, limit: l, totalPages: 1 };
    }
  }
}
