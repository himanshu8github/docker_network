import { Controller, Post, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { LoginDto } from '../auth/dto/login.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.adminService.registerAdmin(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.adminService.loginAdmin(dto);
  }
}
