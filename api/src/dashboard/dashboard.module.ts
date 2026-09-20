import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Blog } from '../blogs/blog.entity';
import { PageVisit } from '../analytics/page-visit.entity';
import { RequestLog } from './request-log.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TelemetryService } from './telemetry.service';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Blog, PageVisit, RequestLog]),
    AuthModule,
    AdminModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, TelemetryService],
  exports: [DashboardService, TelemetryService],
})
export class DashboardModule {}
