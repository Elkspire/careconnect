import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/pg-proxy';
import type { Database } from '../database/database.module';
import { AdminGuard } from './admin.guard';

function setup(isAdmin: boolean) {
  const params: unknown[][] = [];
  const db = drizzle((_sql, p) => {
    params.push(p);
    return Promise.resolve({ rows: isAdmin ? [['user-1']] : [] });
  });
  const guard = new AdminGuard(db as unknown as Database);
  const check = (user?: { id: string }) =>
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext);
  return { check, params };
}

describe('AdminGuard', () => {
  it('allows a platform admin, looked up by their own id', async () => {
    const { check, params } = setup(true);
    await expect(check({ id: 'user-1' })).resolves.toBe(true);
    expect(params[0]![0]).toBe('user-1');
  });

  it('refuses everyone else', async () => {
    const { check } = setup(false);
    await expect(check({ id: 'user-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an unauthenticated request', async () => {
    const { check, params } = setup(true);
    await expect(check()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(params).toEqual([]);
  });
});
