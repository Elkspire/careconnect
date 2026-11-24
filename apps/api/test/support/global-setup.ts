import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Seeded phone identities (supabase/seed/seed.sql) and their fixed OTP
// (supabase/config.toml's [auth.sms.test_otp]).
const SEEDED_PHONES = {
  DOCTOR: '+923001234567',
  PATIENT: '+923007654321',
  RECEPTIONIST: '+923009876543',
};
const TEST_OTP = '123456';

// Blanked so a developer's apps/api/.env can't make the tests send real
// messages. Nest's ConfigModule never overrides a variable that is already
// set, even to an empty string.
const OUTBOUND_ENV = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_SMS_FROM',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
];

function localSupabase(): (key: string) => string {
  let output: string;
  try {
    output = execSync('supabase status -o env', {
      cwd: resolve(__dirname, '../../../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(
      'Could not read the local Supabase stack. Run `supabase start` first.',
    );
  }
  return (key) => {
    const value = new RegExp(`^${key}="?([^"\\r\\n]+)`, 'm').exec(output)?.[1];
    if (!value) throw new Error(`supabase status did not report ${key}`);
    return value;
  };
}

/**
 * Points the API at the local Supabase stack, whatever apps/api/.env says:
 * it may hold hosted credentials, and these tests write data. Also signs the
 * seeded users in once for the whole run.
 */
export default async function globalSetup(): Promise<void> {
  const supabase = localSupabase();

  process.env.SUPABASE_URL = supabase('API_URL');
  process.env.SUPABASE_SERVICE_ROLE_KEY = supabase('SERVICE_ROLE_KEY');
  process.env.DATABASE_URL = supabase('DB_URL');
  process.env.E2E_ANON_KEY = supabase('ANON_KEY');
  for (const key of OUTBOUND_ENV) {
    process.env[key] = '';
  }

  for (const [name, phone] of Object.entries(SEEDED_PHONES)) {
    const client = createClient(supabase('API_URL'), supabase('ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const otp = await client.auth.signInWithOtp({ phone });
    if (otp.error) throw otp.error;
    const { data, error } = await client.auth.verifyOtp({
      phone,
      token: TEST_OTP,
      type: 'sms',
    });
    if (error) throw error;
    process.env[`E2E_${name}_TOKEN`] = data.session!.access_token;
  }
}
