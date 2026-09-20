import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs';
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

  // Sample internal HTTP service probe with short timeout
  private async probeService(url: string, fallbackUrl?: string) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      let target = url;
      let res: Response | null = null;
      try {
        res = await fetch(target, { signal: controller.signal });
      } catch {
        if (fallbackUrl) {
          target = fallbackUrl;
          const fallbackCtrl = new AbortController();
          const fbTimeout = setTimeout(() => fallbackCtrl.abort(), 1500);
          res = await fetch(target, { signal: fallbackCtrl.signal });
          clearTimeout(fbTimeout);
        }
      }
      clearTimeout(timeoutId);

      if (res && (res.ok || res.status < 500)) {
        return {
          status: 'healthy',
          statusCode: res.status,
          latencyMs: Date.now() - start,
          target,
        };
      }
      return {
        status: 'degraded',
        statusCode: res ? res.status : 503,
        latencyMs: Date.now() - start,
        target,
      };
    } catch {
      return {
        status: 'down',
        statusCode: 0,
        latencyMs: -1,
        target: url,
      };
    }
  }

  // Read real EC2 host hardware metrics (from /host/proc if mounted in Docker, or Node OS locally)
  private getHostMetrics() {
    let totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
    let freeMemMb = Math.round(os.freemem() / 1024 / 1024);
    let hostUptimeSec = Math.floor(os.uptime());

    // Check if host /proc is mounted inside container on EC2 Linux
    if (fs.existsSync('/host/proc/meminfo')) {
      try {
        const meminfo = fs.readFileSync('/host/proc/meminfo', 'utf8');
        const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
        const freeMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
        if (totalMatch && freeMatch) {
          totalMemMb = Math.round(parseInt(totalMatch[1], 10) / 1024);
          freeMemMb = Math.round(parseInt(freeMatch[1], 10) / 1024);
        }
      } catch {
        // Fallback to os values
      }
    }

    if (fs.existsSync('/host/proc/uptime')) {
      try {
        const uptimeContent = fs.readFileSync('/host/proc/uptime', 'utf8');
        const upSec = parseFloat(uptimeContent.split(' ')[0]);
        if (!isNaN(upSec)) hostUptimeSec = Math.floor(upSec);
      } catch {
        // Fallback to os values
      }
    }

    const usedMemMb = Math.max(0, totalMemMb - freeMemMb);
    const memPercent = totalMemMb > 0 ? ((usedMemMb / totalMemMb) * 100).toFixed(1) : '0';

    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    const cpuCount = cpus ? cpus.length : 1;
    const cpuLoadPercent = Math.min(100, Math.round(((loadAvg[0] || 0.1) / cpuCount) * 100));

    const days = Math.floor(hostUptimeSec / 86400);
    const hours = Math.floor((hostUptimeSec % 86400) / 3600);
    const mins = Math.floor((hostUptimeSec % 3600) / 60);

    return {
      platform: `${os.type()} ${os.arch()}`,
      cpuCores: cpuCount,
      cpuModel: cpus[0]?.model || 'EC2 vCPU',
      cpuLoadPercent,
      loadAvg: [loadAvg[0].toFixed(2), loadAvg[1].toFixed(2), loadAvg[2].toFixed(2)],
      totalMemMb,
      usedMemMb,
      freeMemMb,
      memPercent,
      hostUptimeFormatted: `${days > 0 ? days + 'd ' : ''}${hours}h ${mins}m`,
    };
  }

  // Multi-Service Health & Topology Matrix
  async getSystemHealth() {
    const host = this.getHostMetrics();

    // 1. MySQL DB Ping
    const startDb = Date.now();
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    try {
      await this.userRepository.query('SELECT 1 as ping');
      dbLatencyMs = Date.now() - startDb;
    } catch {
      dbStatus = 'down';
      dbLatencyMs = -1;
    }

    // 2. NestJS Process Stats
    const mem = process.memoryUsage();
    const procUptimeSec = Math.floor(process.uptime());

    // 3. Service Probes (Docker container names with localhost fallbacks)
    const [userUiProbe, adminUiProbe, nginxProbe] = await Promise.all([
      this.probeService('http://ui-user:3001', 'http://localhost:3001'),
      this.probeService('http://ui-admin:3002/admin.html', 'http://localhost:3002/admin.html'),
      this.probeService('http://nginx-proxy/nginx-health', 'http://localhost/nginx-health'),
    ]);

    return {
      host,
      services: [
        {
          id: 'mysql',
          name: 'MySQL 8.0 Database',
          role: 'Relational Database & Volume Storage',
          endpoint: 'mysql:3306',
          status: dbStatus,
          latencyMs: dbLatencyMs,
          details: dbStatus === 'healthy' ? 'InnoDB Pool Active' : 'Connection Failed',
        },
        {
          id: 'nestjs-app',
          name: 'NestJS Backend API',
          role: 'Core REST API & Crypto Auth',
          endpoint: 'api.gradmetric.me (3000)',
          status: 'healthy',
          latencyMs: 0,
          details: `RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB | Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        },
        {
          id: 'ui-user',
          name: 'User Blog Frontend',
          role: 'Public Community Portal',
          endpoint: 'gradmetric.me (3001)',
          status: userUiProbe.status,
          latencyMs: userUiProbe.latencyMs,
          details: `HTTP ${userUiProbe.statusCode} | Vite Static Engine`,
        },
        {
          id: 'ui-admin',
          name: 'Admin Observability Console',
          role: 'Live Telemetry & Ingress Stream',
          endpoint: 'logs.gradmetric.me (3002)',
          status: adminUiProbe.status,
          latencyMs: adminUiProbe.latencyMs,
          details: `HTTP ${adminUiProbe.statusCode} | Web3 Telemetry Engine`,
        },
        {
          id: 'nginx-proxy',
          name: 'Nginx Reverse Proxy & Load Balancer',
          role: 'Edge Ingress, SSL Termination & Host Routing',
          endpoint: 'nginx-proxy:80',
          status: nginxProbe.status,
          latencyMs: nginxProbe.latencyMs,
          details: nginxProbe.status === 'healthy' ? 'Virtual Hosts & Upstreams Active' : 'Awaiting Docker Network Ingress',
        },
      ],
      processUptimeFormatted: `${Math.floor(procUptimeSec / 3600)}h ${Math.floor((procUptimeSec % 3600) / 60)}m ${procUptimeSec % 60}s`,
    };
  }

  // Live Metrics for Admin Overview
  async getMetrics(headers: Record<string, any>, page = 1, limit = 10) {
    const systemHealth = await this.getSystemHealth();
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

    const dbService = systemHealth.services.find((s) => s.id === 'mysql');

    return {
      overview: {
        totalUsers,
        totalBlogs,
        totalVisits,
        dbStatus: dbService?.status || 'healthy',
        dbLatencyMs: dbService?.latencyMs || 0,
        uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
        memoryRssMb: (mem.rss / 1024 / 1024).toFixed(1),
        memoryHeapMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
      },
      systemHealth,
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
