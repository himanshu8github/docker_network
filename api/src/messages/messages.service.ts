import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService implements OnModuleInit {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async onModuleInit() {
    // Seed initial industry-grade DevOps records if database is empty
    try {
      const count = await this.messageRepository.count();
      if (count === 0) {
        await this.messageRepository.save([
          {
            tab: 'incident',
            title: 'Nginx Reverse Proxy & Cloudflare WAF Ingress Active',
            message: 'Port 80/443 ingress configured with reverse proxy to internal NestJS container. SSL termination handled at edge.',
            status: 'deployed',
            category: 'Nginx',
            environment: 'Production',
            author: 'DevOps Lead',
            metadata: JSON.stringify({ latency: '12ms', region: 'us-east-1' }),
          },
          {
            tab: 'incident',
            title: 'Database Network Isolation Verified',
            message: 'Confirmed MySQL 3306 is not published to host. Internal container DNS (DB_HOST=mysql) resolving via 127.0.0.11.',
            status: 'operational',
            category: 'Security',
            environment: 'Production',
            author: 'Site Reliability Eng',
            metadata: JSON.stringify({ latency: '2ms', network: 'app-net' }),
          },
          {
            tab: 'insight',
            title: 'Why We Terminate SSL at Cloudflare Edge and Proxy via Nginx',
            message: 'Offloading SSL handshakes to Cloudflare Anycast edge points reduces origin EC2 CPU load, enables DDoS mitigation, and enforces Bot Fight Mode before traffic reaches port 80.',
            status: 'resolved',
            category: 'Cloudflare',
            environment: 'Edge',
            author: 'Cloud Architect',
            metadata: JSON.stringify({ tag: '#Cloudflare', readTime: '2 min' }),
          },
          {
            tab: 'insight',
            title: 'Docker Embedded DNS vs Host localhost Pitfalls',
            message: 'Within user-defined bridge networks, Docker runs an embedded DNS resolver at 127.0.0.11. Pointing to localhost fails because each container has its own loopback network interface.',
            status: 'operational',
            category: 'Docker',
            environment: 'Production',
            author: 'DevOps Engineer',
            metadata: JSON.stringify({ tag: '#Docker', readTime: '3 min' }),
          },
        ]);
      }
    } catch (err) {
      console.warn('Initial seeding skipped or pending database sync:', err.message);
    }
  }

  async create(createMessageDto: CreateMessageDto): Promise<Message> {
    const newMessage = this.messageRepository.create({
      tab: createMessageDto.tab || 'incident',
      title: createMessageDto.title || 'Deployment Update',
      message: createMessageDto.message,
      status: createMessageDto.status || 'operational',
      category: createMessageDto.category || 'General',
      environment: createMessageDto.environment || 'Production',
      author: createMessageDto.author || 'DevOps Engineer',
      metadata: createMessageDto.metadata || null,
    });
    return await this.messageRepository.save(newMessage);
  }

  async findAll(tab?: string): Promise<Message[]> {
    const whereClause = tab ? { tab } : {};
    return await this.messageRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Record with ID ${id} not found`);
    }
    return message;
  }

  async getTelemetry(headers: Record<string, any>) {
    const startDb = Date.now();
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;

    try {
      await this.messageRepository.query('SELECT 1 as ping');
      dbLatencyMs = Date.now() - startDb;
    } catch (e) {
      dbStatus = 'degraded';
      dbLatencyMs = -1;
    }

    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());

    const realClientIp =
      headers['cf-connecting-ip'] ||
      headers['x-real-ip'] ||
      (headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() : '127.0.0.1');

    const totalDeployments = await this.messageRepository.count({ where: { tab: 'incident' } });
    const totalInsights = await this.messageRepository.count({ where: { tab: 'insight' } });

    return {
      system: {
        status: dbStatus === 'healthy' ? 'operational' : 'degraded',
        uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
        uptimeSeconds: uptimeSec,
        platform: `${process.platform} (${process.arch})`,
        nodeVersion: process.version,
        memoryRssMb: (mem.rss / 1024 / 1024).toFixed(1),
        memoryHeapMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
        slaPercentage: '99.98%',
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        driver: 'MySQL 8.x',
        isolatedPort: 3306,
        internalHost: 'mysql (127.0.0.11 DNS)',
      },
      edge: {
        isCloudflare: !!headers['cf-ray'],
        cfRay: headers['cf-ray'] || 'direct-ingress',
        cfCountry: headers['cf-ipcountry'] || 'LOCAL',
        realClientIp,
        host: headers['host'] || 'localhost',
        forwardedProto: headers['x-forwarded-proto'] || 'http',
        userAgent: headers['user-agent'] || 'Unknown',
        wafStatus: headers['cf-ray'] ? 'Protected by Cloudflare WAF' : 'Local Ingress',
      },
      stats: {
        totalDeployments,
        totalInsights,
        cacheHitRate: '94.2%',
        avgEdgeLatencyMs: 14,
      },
    };
  }
}
