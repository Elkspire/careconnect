import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// jose v6 ships ESM-only. This file compiles to CommonJS (no "type": "module"
// in apps/api/package.json), and Node refuses a require() of a pure-ESM
// package — confirmed failing at runtime with ERR_REQUIRE_ESM even though
// `nest build`/tsc compiled it without error. Dynamic import() is Node's
// supported interop path from CommonJS to ESM.
let josePromise: Promise<typeof import('jose')> | undefined;
function loadJose(): Promise<typeof import('jose')> {
  josePromise ??= import('jose');
  return josePromise;
}

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
  private readonly logger = new Logger(SupabaseAuthGuard.name);
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
      const jose = await loadJose();
      const result = await jose.jwtVerify(token, await this.getJwks());
      payload = result.payload as SupabaseJwtPayload;
    } catch (err) {
      // The client only ever sees the generic message below — this is the
      // only place the *actual* reason (expired, bad signature, wrong
      // issuer, JWKS endpoint unreachable, ...) is visible at all. A fetch
      // failure's real reason (DNS, TLS, connection refused, ...) lives in
      // `.cause`, not `.message` — Node's undici wraps it as a generic
      // "fetch failed" otherwise.
      const cause =
        err instanceof Error && err.cause ? ` (cause: ${String(err.cause)})` : '';
      this.logger.warn(
        `Token verification failed against SUPABASE_URL=${this.config.get<string>('SUPABASE_URL')}: ${err instanceof Error ? err.message : String(err)}${cause}`,
      );
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

  private async getJwks(): Promise<JWTVerifyGetKey> {
    if (!this.jwks) {
      const jose = await loadJose();
      const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
      this.jwks = jose.createRemoteJWKSet(
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
