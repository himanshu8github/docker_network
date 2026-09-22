import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { RefreshToken } from './refresh-token.entity';
import { CryptoService } from './crypto.service';
import { BloomFilterService } from './bloom-filter.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly cryptoService: CryptoService,
    private readonly bloomFilterService: BloomFilterService,
  ) {}

  async onModuleInit() {
    // Ensure default 'admin' and 'user' roles exist in database
    try {
      let adminRole = await this.roleRepository.findOne({ where: { name: 'admin' } });
      if (!adminRole) {
        adminRole = await this.roleRepository.save({ name: 'admin' });
      }

      let userRole = await this.roleRepository.findOne({ where: { name: 'user' } });
      if (!userRole) {
        userRole = await this.roleRepository.save({ name: 'user' });
      }
    } catch (err) {
      console.warn('Role initialization pending DB readiness:', err.message);
    }
  }

  // Real-time username check using Bloom Filter + DB
  async checkUsername(username: string) {
    if (!username || !/^[a-zA-Z0-9]+$/.test(username) || username.length < 3 || username.length > 30) {
      return { available: false, message: 'Must be 3-30 alphanumeric characters' };
    }

    const mightBeTaken = this.bloomFilterService.mightContain(username);
    if (!mightBeTaken) {
      // 100% available without querying MySQL!
      return { available: true, message: 'Username is available' };
    }

    // Double check with MySQL
    const existing = await this.userRepository.findOne({ where: { username } });
    return {
      available: !existing,
      message: existing ? 'Username already taken' : 'Username is available',
    };
  }

  // Register User
  async register(registerDto: RegisterDto) {
    // 1. Check email uniqueness
    const existingEmail = await this.userRepository.findOne({ where: { email: registerDto.email } });
    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }

    // 2. Check username uniqueness
    const existingUsername = await this.userRepository.findOne({ where: { username: registerDto.username } });
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    // 3. Hash password with salt
    const passwordHash = this.cryptoService.hashPassword(registerDto.password);

    // 4. Assign user role
    const userRole = await this.roleRepository.findOne({ where: { name: 'user' } });
    if (!userRole) throw new BadRequestException('User role not initialized');

    // 5. Create user
    const newUser = this.userRepository.create({
      email: registerDto.email,
      username: registerDto.username,
      passwordHash,
      roleId: userRole.id,
      role: userRole,
    });
    const savedUser = await this.userRepository.save(newUser);

    // 6. Update Bloom Filter
    this.bloomFilterService.add(savedUser.username);

    // 7. Generate User Tokens (Access: 2 Hours = 7200s, Refresh: 2 Days = 172800s)
    const accessToken = this.cryptoService.generateToken(
      { id: savedUser.id, email: savedUser.email, username: savedUser.username, role: 'user' },
      7200, // 2 hours
    );

    const rawRefreshToken = this.cryptoService.generateRefreshTokenString({ id: savedUser.id, role: 'user' });
    const tokenHash = this.cryptoService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days

    await this.refreshTokenRepository.save({
      userId: savedUser.id,
      tokenHash,
      role: 'user',
      expiresAt,
      isRevoked: false,
    });

    return {
      user: {
        // id: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
        role: 'user',
        createdAt: savedUser.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      // expiresIn: 7200,
    };
  }

  // Login User
  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({ where: { email: loginDto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = this.cryptoService.verifyPassword(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roleName = user.role?.name || 'user';

    // Access Token: 2 Hours (7200s), Refresh Token: 2 Days (172800s)
    const accessToken = this.cryptoService.generateToken(
      { id: user.id, email: user.email, username: user.username, role: roleName as any },
      7200,
    );

    const rawRefreshToken = this.cryptoService.generateRefreshTokenString({ id: user.id, role: roleName });
    const tokenHash = this.cryptoService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash,
      role: roleName,
      expiresAt,
      isRevoked: false,
    });

    return {
      user: {
        // id: user.id,
        email: user.email,
        username: user.username,
        role: roleName,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      // expiresIn: 7200,
    };
  }

  // Refresh Access Token
  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const tokenHash = this.cryptoService.hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash, isRevoked: false },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({ where: { id: storedToken.userId } });
    if (!user) throw new UnauthorizedException('User account no longer exists');

    const roleName = user.role?.name || 'user';
    const accessLifespan = roleName === 'admin' ? 86400 : 7200;

    const newAccessToken = this.cryptoService.generateToken(
      { id: user.id, email: user.email, username: user.username, role: roleName as any },
      accessLifespan,
    );

    return {
      accessToken: newAccessToken,
      expiresIn: accessLifespan,
    };
  }

  // Set Custom Alphanumeric Username (4 to 10 characters)
  async setUsername(userPayload: any, rawUsername: string) {
    const username = (rawUsername || '').trim();

    // Enforce strictly alphanumeric, min 4 and max 10 chars
    if (!/^[a-zA-Z0-9]{4,10}$/.test(username)) {
      throw new BadRequestException(
        'Username must be between 4 and 10 characters and contain only letters and numbers (no spaces or special characters)',
      );
    }

    // Check if taken by another user
    const existing = await this.userRepository.findOne({ where: { username } });
    if (existing && existing.id !== userPayload.sub && existing.clerkId !== userPayload.clerkId) {
      throw new ConflictException('Username is already taken. Please choose another.');
    }

    // Find user record by sub or clerkId
    let user = await this.userRepository.findOne({
      where: [{ id: userPayload.sub }, { clerkId: userPayload.clerkId }],
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    user.username = username;
    const saved = await this.userRepository.save(user);

    // Update Bloom Filter
    this.bloomFilterService.add(username);

    return {
      success: true,
      username: saved.username,
      message: 'Username successfully updated',
    };
  }
}
