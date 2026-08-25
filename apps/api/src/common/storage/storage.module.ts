import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_STORAGE = Symbol('SUPABASE_STORAGE');

/**
 * Service-role Supabase client used only for Storage (patient-records
 * bucket). Not used for Postgres access — DatabaseModule/Drizzle owns that.
 * Bypasses Storage RLS the same way DatabaseModule bypasses table RLS; see
 * 0001_init.sql's RLS strategy notes.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
        ),
    },
  ],
  exports: [SUPABASE_STORAGE],
})
export class StorageModule {}
