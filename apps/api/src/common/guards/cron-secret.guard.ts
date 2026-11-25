import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/**
 * Vercel sends `Authorization: Bearer $CRON_SECRET` with every cron request.
 * Refuses everything when CRON_SECRET is unset. Both sides are hashed so the
 * constant-time comparison gets equal lengths.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  private readonly logger = new Logger(CronSecretGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      this.logger.error('Cron request refused: CRON_SECRET is not set');
      throw new UnauthorizedException();
    }
    const { authorization } = context
      .switchToHttp()
      .getRequest<Request>().headers;
    if (
      !authorization ||
      !timingSafeEqual(sha256(authorization), sha256(`Bearer ${secret}`))
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
