import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_ADMIN = Symbol('SUPABASE_ADMIN');

/**
 * Service-role Supabase client used for Auth Admin calls — currently just
 * ClinicService.inviteStaff, to create an account for someone who has never
 * logged in to CareConnect yet. Separate from StorageModule's service-role
 * client, which is scoped to Storage only.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
        ),
    },
  ],
  exports: [SUPABASE_ADMIN],
})
export class SupabaseAdminModule {}
