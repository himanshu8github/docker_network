import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/guards/clerk-auth.guard';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly clerkAuthGuard: ClerkAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuth = await this.clerkAuthGuard.canActivate(context);
    if (!isAuth) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Access denied: Admin role required');
    }

    return true;
  }
}
