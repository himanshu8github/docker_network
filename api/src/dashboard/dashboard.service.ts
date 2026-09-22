import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs';
import * as http from 'http';
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

  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Direct HTTP-over-Unix-socket query to Docker daemon (/var/run/docker.sock)
  private queryDockerSocket<T = any>(path: string): Promise<T | null> {
    return new Promise((resolve) => {
      const socketPath = '/var/run/docker.sock';
      if (!fs.existsSync(socketPath)) {
        return resolve(null);
      }
      try {
        const req = http.request(
          {
            socketPath,
            path,
            method: 'GET',
            timeout: 3500,
            headers: {
              Host: 'docker.sock',
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(null);
              }
            });
          },
        );
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
        req.on('error', () => {
          resolve(null);
        });
        req.end();
      } catch {
        resolve(null);
      }
    });
  }

  // 100% Real Live Metrics for Containers and Volumes from Docker Engine
  private async getRealContainerMetrics(hostTotalMemMb: number) {
    const socketPath = '/var/run/docker.sock';
    if (!fs.existsSync(socketPath)) {
      return {
        dockerEngineActive: false,
        source: 'Docker Unix Socket (/var/run/docker.sock) not mounted',
        totalContainers: 0,
        containers: [],
        volumes: [],
      };
    }

    try {
      const [containersList, systemDf] = await Promise.all([
        this.queryDockerSocket<any[]>('/containers/json?all=true&size=true'),
        this.queryDockerSocket<any>('/system/df'),
      ]);

      if (!Array.isArray(containersList)) {
        return {
          dockerEngineActive: false,
          source: 'Docker Engine daemon did not return container list',
          totalContainers: 0,
          containers: [],
          volumes: [],
        };
      }

      // Query live stats for running containers in parallel
      const statsList = await Promise.all(
        containersList.map(async (c) => {
          if (c.State === 'running') {
            const stats = await this.queryDockerSocket<any>(`/containers/${c.Id}/stats?stream=false`);
            return { id: c.Id, stats };
          }
          return { id: c.Id, stats: null };
        }),
      );

      const statsMap = new Map<string, any>();
      for (const s of statsList) {
        if (s.stats) statsMap.set(s.id, s.stats);
      }

      // Real Volume Storage from Docker engine
      const volumes = (systemDf?.Volumes || []).map((v: any) => {
        const sizeBytes = v.UsageData?.Size ?? 0;
        return {
          name: v.Name,
          driver: v.Driver,
          sizeBytes,
          sizeFormatted: this.formatBytes(sizeBytes),
          refCount: v.UsageData?.RefCount ?? 0,
        };
      });

      // Real Containers metrics from Docker engine
      const containers = containersList.map((c) => {
        const rawName = c.Names && c.Names[0] ? c.Names[0].replace(/^\//, '') : c.Id.slice(0, 12);
        const stats = statsMap.get(c.Id);

        let memUsageBytes = 0;
        let memLimitBytes = 0;
        let cpuPercent = 0;

        if (stats && stats.memory_stats) {
          const usage = stats.memory_stats.usage || 0;
          const cache = stats.memory_stats.stats?.cache || stats.memory_stats.stats?.inactive_file || 0;
          memUsageBytes = Math.max(0, usage - cache);
          memLimitBytes = stats.memory_stats.limit || (hostTotalMemMb * 1024 * 1024);
        }

        if (stats && stats.cpu_stats && stats.precpu_stats) {
          const cpuDelta = (stats.cpu_stats.cpu_usage?.total_usage || 0) - (stats.precpu_stats.cpu_usage?.total_usage || 0);
          const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
          const onlineCpus = stats.cpu_stats.online_cpus || (stats.cpu_stats.cpu_usage?.percpu_usage?.length || 1);
          if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = Number(((cpuDelta / systemDelta) * onlineCpus * 100).toFixed(1));
          }
        }

        const sizeRwBytes = c.SizeRw ?? 0;
        const sizeRootFsBytes = c.SizeRootFs ?? 0;
        const memPercent = memLimitBytes > 0 ? Number(((memUsageBytes / memLimitBytes) * 100).toFixed(1)) : 0;

        return {
          id: c.Id.slice(0, 12),
          name: rawName,
          image: c.Image,
          state: c.State,
          status: c.Status,
          // Real Space metrics
          sizeRwBytes,
          sizeRwFormatted: this.formatBytes(sizeRwBytes),
          sizeRootFsBytes,
          sizeRootFsFormatted: this.formatBytes(sizeRootFsBytes),
          // Real Memory metrics
          memUsageBytes,
          memUsageFormatted: this.formatBytes(memUsageBytes),
          memLimitBytes,
          memPercent,
          // Real CPU metrics
          cpuPercent,
        };
      });

      return {
        dockerEngineActive: true,
        source: 'Docker Engine API (/var/run/docker.sock)',
        totalContainers: containers.length,
        containers,
        volumes,
      };
    } catch (err: any) {
      return {
        dockerEngineActive: false,
        source: `Docker Engine query error: ${err.message}`,
        totalContainers: 0,
        containers: [],
        volumes: [],
      };
    }
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
    const [userUiProbe, adminUiProbe, nginxProbe, dockerMetrics] = await Promise.all([
      this.probeService('http://ui-user:3001', 'http://localhost:3001'),
      this.probeService('http://ui-admin:3002/admin.html', 'http://localhost:3002/admin.html'),
      this.probeService('http://nginx-proxy/nginx-health', 'http://localhost/nginx-health'),
      this.getRealContainerMetrics(host.totalMemMb),
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
      dockerMetrics,
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
      telemetryInfo: {
        appName: 'CloudOps.Gradmetric',
        logGroupName: '/gradmetric-cloudops/production/ingress',
        logStreamName: 'live-ingress-stream',
      },
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
