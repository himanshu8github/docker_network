import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CryptoService, TokenPayload } from '../crypto.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly cryptoService: CryptoService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload: TokenPayload = this.cryptoService.verifyToken(token);
      request.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException(err.message || 'Invalid or expired token');
    }
  }
}
