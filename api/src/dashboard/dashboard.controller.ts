import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { AdminRoleGuard } from '../admin/guards/admin-role.guard';

@Controller('dashboard')
@UseGuards(AdminRoleGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(@Req() req: Request) {
    return this.dashboardService.getMetrics(req.headers);
  }

  @Get('users')
  getUsersDirectory() {
    return this.dashboardService.getUsersDirectory();
  }

  @Get('visits')
  getVisitsAnalytics() {
    return this.dashboardService.getVisitsAnalytics();
  }
}
