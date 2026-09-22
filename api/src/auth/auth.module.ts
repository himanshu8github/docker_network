import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { RefreshToken } from './refresh-token.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CryptoService } from './crypto.service';
import { BloomFilterService } from './bloom-filter.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, RefreshToken])],
  controllers: [AuthController],
  providers: [AuthService, CryptoService, BloomFilterService, JwtAuthGuard, ClerkAuthGuard],
  exports: [AuthService, CryptoService, JwtAuthGuard, ClerkAuthGuard, BloomFilterService],
})
export class AuthModule {}
