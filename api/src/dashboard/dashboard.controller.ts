import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { AdminRoleGuard } from '../admin/guards/admin-role.guard';

@Controller('dashboard')
@UseGuards(AdminRoleGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getMetrics(req.headers, page, limit);
  }

  @Get('system-health')
  getSystemHealth() {
    return this.dashboardService.getSystemHealth();
  }

  @Get('users')
  getUsersDirectory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getUsersDirectory(page, limit);
  }

  @Get('visits')
  getVisitsAnalytics(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getVisitsAnalytics(page, limit);
  }
}
