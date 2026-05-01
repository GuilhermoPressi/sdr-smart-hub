import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Aceita x-api-key como alternativa ao JWT (para integração frontend sem login)
    const apiKey = request.headers['x-api-key'] as string;
    const internalKey = process.env.INTERNAL_API_KEY;

    if (internalKey && apiKey === internalKey) {
      request['user'] = { sub: 'internal', id: 'internal', companyId: null };
      return true;
    }

    // Fallback para JWT
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token ou API key não fornecidos.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
