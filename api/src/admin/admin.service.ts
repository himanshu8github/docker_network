import {
  Injectable,
  OnModuleInit,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { CryptoService } from '../auth/crypto.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { LoginDto } from '../auth/dto/login.dto';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly cryptoService: CryptoService,
  ) {}

  async onModuleInit() {
    try {
      // Ensure 'admin' and 'user' roles exist
      let adminRole = await this.roleRepository.findOne({ where: { name: 'admin' } });
      if (!adminRole) {
        adminRole = await this.roleRepository.save({ name: 'admin' });
      }

      let userRole = await this.roleRepository.findOne({ where: { name: 'user' } });
      if (!userRole) {
        await this.roleRepository.save({ name: 'user' });
      }
    } catch (err) {
      console.warn('[Init] Roles initialization check failed:', err.message);
    }
  }

  // Register Admin Account
  async registerAdmin(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });
    if (existing) {
      throw new ConflictException('Admin email or username already in use');
    }

    let adminRole = await this.roleRepository.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      adminRole = await this.roleRepository.save({ name: 'admin' });
    }

    const passwordHash = this.cryptoService.hashPassword(dto.password);

    const newAdmin = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      roleId: adminRole.id,
      role: adminRole,
    });
    const savedAdmin = await this.userRepository.save(newAdmin);

    // Admin Access Token: 1 Day = 86400s, Refresh Token: 2 Days = 172800s
    const accessToken = this.cryptoService.generateToken(
      { id: savedAdmin.id, email: savedAdmin.email, username: savedAdmin.username, role: 'admin' },
      86400,
    );

    const rawRefreshToken = this.cryptoService.generateRefreshTokenString({ id: savedAdmin.id, role: 'admin' });
    const tokenHash = this.cryptoService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.save({
      userId: savedAdmin.id,
      tokenHash,
      role: 'admin',
      expiresAt,
      isRevoked: false,
    });

    return {
      admin: {
        // id: savedAdmin.id,
        email: savedAdmin.email,
        username: savedAdmin.username,
        role: 'admin',
        createdAt: savedAdmin.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      // expiresIn: 86400,
    };
  }

  // Admin Login
  async loginAdmin(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    if (user.role?.name !== 'admin') {
      throw new ForbiddenException('Access denied: User is not an admin');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid admin credentials. Please use Clerk SSO authentication.');
    }

    const isMatch = this.cryptoService.verifyPassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Admin Access Token: 1 Day (86400s), Refresh Token: 2 Days (172800s)
    const accessToken = this.cryptoService.generateToken(
      { id: user.id, email: user.email, username: user.username, role: 'admin' },
      86400,
    );

    const rawRefreshToken = this.cryptoService.generateRefreshTokenString({ id: user.id, role: 'admin' });
    const tokenHash = this.cryptoService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash,
      role: 'admin',
      expiresAt,
      isRevoked: false,
    });

    return {
      admin: {
        // id: user.id,
        email: user.email,
        username: user.username,
        role: 'admin',
      },
      accessToken,
      refreshToken: rawRefreshToken,
      // expiresIn: 86400,
    };
  }
}
