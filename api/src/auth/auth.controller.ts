import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto.refreshToken);
  }

  @Get('check-username')
  checkUsername(@Query('username') username: string) {
    return this.authService.checkUsername(username);
  }

  @Post('set-username')
  @UseGuards(ClerkAuthGuard)
  setUsername(@Body('username') username: string, @Req() req: any) {
    return this.authService.setUsername(req.user, username);
  }

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getMe(@Req() req: any) {
    return { user: req.user };
  }
}
