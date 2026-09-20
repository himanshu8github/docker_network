import { Injectable } from '@nestjs/common';

export interface RequestLogEntry {
  id: string;
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
export class TelemetryService {
  private readonly maxLogs = 50;
  private logs: RequestLogEntry[] = [];

  // Live real counters (starting at 0)
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

  recordRequest(entry: Omit<RequestLogEntry, 'id' | 'timestamp'>) {
    this.counters.totalRequests++;

    const methodUpper = entry.method.toUpperCase();
    if (methodUpper === 'GET') this.counters.getRequests++;
    else if (methodUpper === 'POST') this.counters.postRequests++;
    else if (methodUpper === 'PATCH' || methodUpper === 'PUT') this.counters.patchRequests++;
    else if (methodUpper === 'DELETE') this.counters.deleteRequests++;

    if (entry.statusCode >= 200 && entry.statusCode < 300) this.counters.status2xx++;
    else if (entry.statusCode >= 400 && entry.statusCode < 500) this.counters.status4xx++;
    else if (entry.statusCode >= 500) this.counters.status5xx++;

    const newEntry: RequestLogEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
    };

    this.logs.unshift(newEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  getRecentLogs(limit = 30): RequestLogEntry[] {
    return this.logs.slice(0, limit);
  }
}
