import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Shape of the decoded Supabase access token this app relies on.
 * Supabase phone-OTP auth puts the phone number in `phone`, not `email`.
 */
export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  phone?: string;
  email?: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  phone?: string;
  email?: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/**
 * Global guard verifying the Supabase-issued JWT on every request unless
 * the route is marked @Public(). Verifies against Supabase's JWKS endpoint
 * (asymmetric ES256) — confirmed live against a real local Supabase
 * instance that the legacy shared-secret (HS256) approach this guard
 * originally used no longer matches: `supabase start` as of CLI 2.115.0
 * issues ES256-signed tokens by default (`{"alg":"ES256",...}` in the
 * token header), and verifying those with jsonwebtoken+shared-secret fails
 * every request with "invalid signature". JWKS is fetched once and cached
 * (with automatic rotation handling) by jose's createRemoteJWKSet, not
 * re-fetched per request.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwks: JWTVerifyGetKey | undefined;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: SupabaseJwtPayload;
    try {
      const result = await jwtVerify(token, this.getJwks());
      payload = result.payload as SupabaseJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.role !== 'authenticated') {
      throw new UnauthorizedException(
        'Token is not an authenticated user session',
      );
    }

    request.user = {
      id: payload.sub,
      phone: payload.phone,
      email: payload.email,
    };
    return true;
  }

  private getJwks(): JWTVerifyGetKey {
    if (!this.jwks) {
      const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
      this.jwks = createRemoteJWKSet(
        new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
      );
    }
    return this.jwks;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length);
  }
}
