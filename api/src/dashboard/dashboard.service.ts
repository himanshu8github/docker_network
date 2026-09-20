import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Blog } from '../blogs/blog.entity';
import { PageVisit } from '../analytics/page-visit.entity';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Blog)
    private readonly blogRepository: Repository<Blog>,
    @InjectRepository(PageVisit)
    private readonly pageVisitRepository: Repository<PageVisit>,
    private readonly telemetryService: TelemetryService,
  ) {}

  // Live Metrics for Admin Overview
  async getMetrics(headers: Record<string, any>, page = 1, limit = 10) {
    const startDb = Date.now();
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;

    try {
      await this.userRepository.query('SELECT 1 as ping');
      dbLatencyMs = Date.now() - startDb;
    } catch {
      dbStatus = 'degraded';
      dbLatencyMs = -1;
    }

    const totalUsers = await this.userRepository.count();
    const totalBlogs = await this.blogRepository.count();
    const totalVisits = await this.pageVisitRepository.count();

    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());

    const cfRay = headers['cf-ray'] || 'direct-ingress';
    const clientIp =
      headers['cf-connecting-ip'] ||
      headers['x-real-ip'] ||
      (headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() : '127.0.0.1');

    return {
      overview: {
        totalUsers,
        totalBlogs,
        totalVisits,
        dbStatus,
        dbLatencyMs,
        uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
        memoryRssMb: (mem.rss / 1024 / 1024).toFixed(1),
        memoryHeapMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
      },
      cloudflare: {
        isCloudflare: !!headers['cf-ray'],
        cfRay,
        country: headers['cf-ipcountry'] || 'LOCAL',
        clientIp,
        host: headers['host'] || 'localhost',
        proto: headers['x-forwarded-proto'] || 'http',
      },
      counters: this.telemetryService.counters,
      liveStream: await this.telemetryService.getRecentLogs(limit, page),
    };
  }

  // Users Directory Tab for Admin (with pagination)
  async getUsersDirectory(page = 1, limit = 10) {
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    const p = Math.max(1, Number(page) || 1);
    const skip = (p - 1) * l;

    const [users, total] = await this.userRepository.findAndCount({
      relations: ['role', 'blogs'],
      order: { createdAt: 'DESC' },
      skip,
      take: l,
    });

    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role?.name || 'user',
        registeredAt: u.createdAt,
        blogsCount: u.blogs ? u.blogs.length : 0,
      })),
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    };
  }

  // Visit Analytics for Admin (with pagination)
  async getVisitsAnalytics(page = 1, limit = 10) {
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    const p = Math.max(1, Number(page) || 1);
    const skip = (p - 1) * l;

    const [visits, total] = await this.pageVisitRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: l,
    });

    return {
      items: visits,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    };
  }
}
