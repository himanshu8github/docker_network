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
      if (!this.clerkClient) {
        this.clerkClient = createClerkClient({ secretKey });
      }

      try {
        const payload: any = await verifyToken(token, {
          secretKey,
          clockSkewInMs: 60000,
        });
        if (payload && payload.sub) {
          const clerkId = payload.sub;

          // Extract user email strictly from verified Clerk JWT claims or the official Clerk API (NEVER trust unverified client headers)
          let userEmail = (payload.email || '').trim().toLowerCase();

          if (!userEmail && this.clerkClient) {
            try {
              const clerkUser = await this.clerkClient.users.getUser(clerkId);
              const primaryEmailId = clerkUser.primaryEmailAddressId;
              const primary = clerkUser.emailAddresses?.find((e: any) => e.id === primaryEmailId);
              userEmail = (primary?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || '').trim().toLowerCase();
            } catch (err: any) {
              this.logger.warn(`Could not fetch Clerk user details: ${err.message}`);
            }
          }

          // Check for user in local DB by email first (to link pre-existing admin accounts)
          let dbUser = null;
          if (userEmail) {
            dbUser = await this.userRepository.findOne({
              where: { email: userEmail },
              relations: ['role'],
            });
          }

          // Also check by clerkId
          const userByClerk = await this.userRepository.findOne({
            where: { clerkId },
            relations: ['role'],
          });

          if (dbUser) {
            // Reconcile: If a temporary duplicate user was created earlier under clerkId
            if (userByClerk && userByClerk.id !== dbUser.id) {
              this.logger.log(`Merging duplicate user ${userByClerk.id} into real account ${dbUser.id} (${userEmail})`);
              try {
                // Reassign existing blogs first to protect against cascade deletion
                await this.userRepository.query(
                  'UPDATE blogs SET authorId = ?, authorUsername = ? WHERE authorId = ?',
                  [dbUser.id, dbUser.username, userByClerk.id],
                );
                await this.userRepository.delete(userByClerk.id);
              } catch (delErr: any) {
                this.logger.warn(`Could not merge/delete stub user: ${delErr.message}`);
              }
            }
            if (dbUser.clerkId !== clerkId) {
              dbUser.clerkId = clerkId;
              await this.userRepository.save(dbUser);
            }
          } else if (userByClerk) {
            dbUser = userByClerk;
            if (userEmail && dbUser.email !== userEmail && !dbUser.email.includes('@gmail.com') && !dbUser.email.includes('@')) {
              dbUser.email = userEmail;
              await this.userRepository.save(dbUser);
            }
          } else {
            // Neither email nor clerkId found in DB -> Provision new user
            const finalEmail = userEmail || `${clerkId}@clerk.user`;
            const cleanId = clerkId.replace(/[^a-zA-Z0-9]/g, '');
            let username = `u_${cleanId.slice(-6)}`.slice(0, 10);

            let role = await this.roleRepository.findOne({ where: { name: 'user' } });
            let newUser = this.userRepository.create({
              clerkId,
              email: finalEmail,
              username,
              isCustomUsername: false,
              roleId: role ? role.id : 2,
              role: role || undefined,
            });
            try {
              dbUser = await this.userRepository.save(newUser);
            } catch (err: any) {
              this.logger.warn(`Initial user creation collision: ${err.message}. Retrying with unique handle.`);
              const fallbackHandle = `u_${Date.now().toString(36).slice(-4)}`.slice(0, 10);
              newUser.username = fallbackHandle;
              try {
                dbUser = await this.userRepository.save(newUser);
              } catch {
                dbUser = await this.userRepository.findOne({
                  where: [{ clerkId }, { email: finalEmail }],
                  relations: ['role'],
                });
              }
            }
          }

          // Fallback if dbUser still unassigned
          if (!dbUser) {
            dbUser = await this.userRepository.findOne({
              where: [{ clerkId }, ...(userEmail ? [{ email: userEmail }] : [])],
              relations: ['role'],
            });
          }

          // Re-fetch role if missing
          if (dbUser && !dbUser.role && dbUser.roleId) {
            dbUser.role = await this.roleRepository.findOne({ where: { id: dbUser.roleId } });
          }

          // Determine admin status
          const isAdmin =
            dbUser?.roleId === 1 ||
            dbUser?.role?.name === 'admin' ||
            payload.role === 'admin';

          const roleName = isAdmin ? 'admin' : 'user';

          // A handle is pending only if the user hasn't claimed a custom handle yet (and is not an admin)
          // No prefix assumptions: handles like avi90, raj08, user123 are completely valid
          const isPendingHandle = !isAdmin && (dbUser ? !dbUser.isCustomUsername : true);

          request.user = {
            id: dbUser ? dbUser.id : 0,
            sub: dbUser ? dbUser.id : 0,
            clerkId,
            email: dbUser ? dbUser.email : userEmail,
            username: dbUser ? dbUser.username : (payload.username || 'user'),
            roleId: dbUser ? dbUser.roleId : (isAdmin ? 1 : 2),
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
