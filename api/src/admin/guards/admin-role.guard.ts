import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { CryptoService, TokenPayload } from '../../auth/crypto.service';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly cryptoService: CryptoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Admin authentication token required');
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload: TokenPayload = this.cryptoService.verifyToken(token);
      if (payload.role !== 'admin') {
        throw new ForbiddenException('Access denied: Admin role required');
      }
      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }
}
