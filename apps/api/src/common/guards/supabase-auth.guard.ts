import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { and, eq } from 'drizzle-orm';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { DRIZZLE, type Database } from '../database/database.module';
import { authSessions } from '../database/schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** How long a confirmed-live session is trusted before re-checking. */
const SESSION_CHECK_TTL_MS = 60_000;
/** Bound on the per-instance cache; cleared wholesale when exceeded. */
const SESSION_CACHE_MAX = 10_000;

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
  /** The auth.sessions row this access token belongs to. */
  session_id?: string;
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
  /** session_id -> time it was last confirmed to exist (ms). */
  private readonly liveSessions = new Map<string, number>();

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: Database,
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
        err instanceof Error && err.cause
          ? ` (cause: ${err.cause instanceof Error ? err.cause.message : JSON.stringify(err.cause)})`
          : '';
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

    if (!(await this.sessionStillExists(payload))) {
      throw new UnauthorizedException('Session has ended');
    }

    request.user = {
      id: payload.sub,
      phone: payload.phone,
      email: payload.email,
    };
    return true;
  }

  /**
   * A signature check alone accepts any unexpired token — including one for
   * an account that was just deleted (or a session that signed out), for up
   * to the token's remaining lifetime. Supabase deletes the auth.sessions row
   * in both cases, so confirm it still exists. Cached per instance for
   * SESSION_CHECK_TTL_MS, so at most one lookup per session per minute.
   *
   * Fails open on a database error: the signature is already verified, and
   * a DB blip shouldn't sign every user out — it's logged instead.
   */
  private async sessionStillExists(
    payload: SupabaseJwtPayload,
  ): Promise<boolean> {
    const sessionId = payload.session_id;
    if (!sessionId) {
      return true;
    }
    const checkedAt = this.liveSessions.get(sessionId);
    if (
      checkedAt !== undefined &&
      Date.now() - checkedAt < SESSION_CHECK_TTL_MS
    ) {
      return true;
    }
    try {
      const [row] = await this.db
        .select({ id: authSessions.id })
        .from(authSessions)
        .where(
          and(
            eq(authSessions.id, sessionId),
            eq(authSessions.userId, payload.sub),
          ),
        )
        .limit(1);
      if (!row) {
        this.liveSessions.delete(sessionId);
        return false;
      }
      if (this.liveSessions.size >= SESSION_CACHE_MAX) {
        this.liveSessions.clear();
      }
      this.liveSessions.set(sessionId, Date.now());
      return true;
    } catch (err) {
      this.logger.warn(
        `Session check failed, allowing request: ${err instanceof Error ? err.message : String(err)}`,
      );
      return true;
    }
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
