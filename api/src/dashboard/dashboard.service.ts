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
  async getMetrics(headers: Record<string, any>) {
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
      liveStream: this.telemetryService.getRecentLogs(25),
    };
  }

  // Users Directory Tab for Admin (email, username, registered date, blog count)
  async getUsersDirectory() {
    const users = await this.userRepository.find({
      relations: ['role', 'blogs'],
      order: { createdAt: 'DESC' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role?.name || 'user',
      registeredAt: u.createdAt,
      blogsCount: u.blogs ? u.blogs.length : 0,
    }));
  }

  // Visit Analytics for Admin
  async getVisitsAnalytics() {
    const totalVisits = await this.pageVisitRepository.count();
    const recentVisits = await this.pageVisitRepository.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      totalVisits,
      recentVisits,
    };
  }
}
