import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Without this, an exception that isn't an HttpException (a raw driver
 * error, a bug, anything Nest didn't throw itself) got Nest's default
 * handling — which, in this serverless deployment, produced a 500 with
 * *no* visible detail in Vercel's function logs: no message, no stack,
 * just the bare "error" line and an unrelated Node deprecation warning
 * next to it. Every one of those turned into a slow round of adding
 * one-off try/catch + Logger calls per endpoint after the fact (see
 * SupabaseAuthGuard's catch block). This logs the real error once, for
 * everything, before it's lost.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error', statusCode: status };

    if (!isHttpException || status >= 500) {
      const message =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `${request.method ?? ''} ${request.url ?? ''} -> ${status}: ${message}`,
      );
    }

    response.status(status).json(body);
  }
}
