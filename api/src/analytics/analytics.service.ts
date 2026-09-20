import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageVisit } from './page-visit.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(PageVisit)
    private readonly pageVisitRepository: Repository<PageVisit>,
  ) {}

  async recordVisit(endpoint = '/home', headers: Record<string, any>) {
    const clientIp =
      headers['cf-connecting-ip'] ||
      headers['x-real-ip'] ||
      (headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() : '127.0.0.1');

    const country = headers['cf-ipcountry'] || 'LOCAL';
    const cfRay = headers['cf-ray'] || 'direct';
    const userAgent = headers['user-agent'] || 'Unknown';

    await this.pageVisitRepository.save({
      endpoint,
      clientIp,
      country,
      cfRay,
      userAgent: userAgent.slice(0, 500),
    });

    const totalVisits = await this.pageVisitRepository.count();
    return {
      success: true,
      totalVisits,
      edge: {
        isCloudflare: !!headers['cf-ray'],
        cfRay,
        country,
        clientIp,
      },
    };
  }

  async getTotalVisits() {
    return await this.pageVisitRepository.count();
  }
}
