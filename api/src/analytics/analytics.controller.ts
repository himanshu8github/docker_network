import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('visit')
  recordGetVisit(@Req() req: Request) {
    return this.analyticsService.recordVisit('/home', req.headers);
  }

  @Post('visit')
  recordPostVisit(@Body('endpoint') endpoint: string, @Req() req: Request) {
    return this.analyticsService.recordVisit(endpoint || '/home', req.headers);
  }
}
