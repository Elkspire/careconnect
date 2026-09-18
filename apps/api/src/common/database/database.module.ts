import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Connects with the service-role-level DATABASE_URL, so RLS does not apply
 * to queries made through this client — see 0001_init.sql's RLS strategy
 * notes. Guards in common/guards/ are the primary enforcement layer for
 * everything that goes through this module.
 */
@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.getOrThrow<string>('DATABASE_URL');
        const client = postgres(connectionString, {
          prepare: false,
          // Each serverless invocation is its own process — the *external*
          // pooler (Supabase's pgbouncer/Supavisor, DATABASE_URL should
          // point at that, not the direct connection) is what actually
          // pools across every concurrent instance; a large per-instance
          // pool here just multiplies against however many instances are
          // cold-starting at once. connect_timeout matters more: with no
          // limit, a connection that can't be established (pooler
          // exhausted, network hiccup) hangs until Vercel's function
          // timeout kills the whole invocation with zero trace — no
          // exception for AllExceptionsFilter to catch, just a bare
          // platform-level failure. Failing fast here at least produces a
          // real, logged error instead of silence.
          max: 1,
          connect_timeout: 10,
          idle_timeout: 20,
        });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
