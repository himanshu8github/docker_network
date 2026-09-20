import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminRoleGuard } from './guards/admin-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, RefreshToken]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard],
  exports: [AdminService, AdminRoleGuard],
})
export class AdminModule {}
