import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { Role } from '../../roles/role.entity';
import { CryptoService } from '../crypto.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private clerkClient: ReturnType<typeof createClerkClient> | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly cryptoService: CryptoService,
  ) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (secretKey) {
      this.clerkClient = createClerkClient({ secretKey });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token required');
    }

    const token = authHeader.split(' ')[1];
    const secretKey = process.env.CLERK_SECRET_KEY;

    // 1. Primary: Verify with Clerk
    if (secretKey) {
      try {
        const payload: any = await verifyToken(token, { secretKey });
        if (payload && payload.sub) {
          const clerkId = payload.sub;

          // Check if user exists in local database by clerkId
          let dbUser = await this.userRepository.findOne({
            where: { clerkId },
            relations: ['role'],
          });

          // If not in database, sync/provision user from Clerk
          if (!dbUser) {
            let email = payload.email || '';
            let username = payload.username || '';
            let roleName = 'user';

            if (this.clerkClient) {
              try {
                const clerkUser = await this.clerkClient.users.getUser(clerkId);
                email = email || clerkUser.emailAddresses?.[0]?.emailAddress || '';
                username = username || clerkUser.username || '';
                if (clerkUser.publicMetadata?.role === 'admin') {
                  roleName = 'admin';
                }
              } catch (err: any) {
                this.logger.warn(`Could not fetch Clerk user details: ${err.message}`);
              }
            }

            if (!email) {
              email = `${clerkId}@clerk.user`;
            }

            // Check if existing user by email
            const existingByEmail = await this.userRepository.findOne({
              where: { email },
              relations: ['role'],
            });

            if (existingByEmail) {
              existingByEmail.clerkId = clerkId;
              dbUser = await this.userRepository.save(existingByEmail);
            } else {
              // Generate initial temporary handle (4-10 chars) until chosen
              if (!username) {
                const cleanId = clerkId.replace(/[^a-zA-Z0-9]/g, '');
                username = `u${cleanId.slice(-6)}`.slice(0, 10);
              }

              let role = await this.roleRepository.findOne({ where: { name: roleName } });
              if (!role) {
                role = await this.roleRepository.findOne({ where: { name: 'user' } });
              }

              const newUser = this.userRepository.create({
                clerkId,
                email,
                username,
                roleId: role ? role.id : 2,
                role: role || undefined,
              });

              try {
                dbUser = await this.userRepository.save(newUser);
              } catch {
                dbUser = await this.userRepository.findOne({ where: { clerkId }, relations: ['role'] });
              }
            }
          }

          const roleName = dbUser?.role?.name || (payload.role === 'admin' ? 'admin' : 'user');
          const isPendingHandle = !dbUser?.username || dbUser.username.startsWith('u') || dbUser.username.length < 4;

          request.user = {
            sub: dbUser ? dbUser.id : 0,
            clerkId,
            email: dbUser ? dbUser.email : payload.email,
            username: dbUser ? dbUser.username : payload.username || 'user',
            role: roleName,
            needsUsername: isPendingHandle,
          };
          return true;
        }
      } catch (clerkErr: any) {
        this.logger.debug(`Clerk token verification failed: ${clerkErr.message}`);
      }
    }

    // 2. Fallback: Verify with legacy CryptoService (for existing admin sessions)
    try {
      const legacyPayload = this.cryptoService.verifyToken(token);
      request.user = legacyPayload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication session');
    }
  }
}
