-- Local dev seed: one verified doctor with one clinic, one specialty,
-- one receptionist, and one patient — enough to smoke-test M1 through M5.
-- Fixed UUIDs so scripts/tests can reference them directly.
--
-- Phone numbers are stored WITHOUT a leading "+" — GoTrue itself strips it
-- (confirmed by inspecting a real /verify response), and auth.users.phone
-- lookups during OTP verification are an exact string match. A seeded row
-- with "+92..." silently fails to match and GoTrue provisions a brand new
-- user instead of resolving to the seeded one. The API layer's phoneSchema
-- (E.164, "+" required) still governs what patients type into forms; this
-- is purely the storage convention for this table.
--
-- Run automatically by `supabase db reset`, or manually via:
--   psql "$DATABASE_URL" -f supabase/seed/seed.sql

-- ---- auth.users (local dev only — phone/OTP identities, pre-confirmed) ----

-- confirmation_token/recovery_token/email_change_token_new/email_change
-- default to NULL at the schema level, but GoTrue's own Go SQL driver does
-- a direct string Scan on them and errors on NULL ("converting NULL to
-- string is unsupported") the moment it looks up the user — confirmed by
-- hitting a real 500 from /auth/v1/otp against a row that omitted these.
-- Every other *_token/*_change column already defaults to '' at the schema
-- level; only these four need to be set explicitly.
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', '923001234567', now(),
    now(), now(), '{"provider":"phone","providers":["phone"]}', '{}',
    false, false,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', '923007654321', now(),
    now(), now(), '{"provider":"phone","providers":["phone"]}', '{}',
    false, false,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', '923009876543', now(),
    now(), now(), '{"provider":"phone","providers":["phone"]}', '{}',
    false, false,
    '', '', '', ''
  )
on conflict (id) do nothing;

-- ---- domain rows ----

insert into public.practitioners (
  id, slug, full_name, gender, practitioner_type, council_registration_no,
  verification_status, verified_at, bio, languages
) values (
  '11111111-1111-1111-1111-111111111111',
  'dr-ayesha-khan',
  'Dr. Ayesha Khan', 'female', 'doctor', 'PMDC-12345',
  'verified', now(), 'Consultant dermatologist, 12 years experience.',
  array['en', 'ur']
)
on conflict (id) do nothing;

insert into public.patients (id, full_name, gender, preferred_language)
values (
  '22222222-2222-2222-2222-222222222222',
  'Bilal Ahmed', 'male', 'en'
)
on conflict (id) do nothing;

insert into public.specialties (id, name_en, name_ur, practitioner_type, slug)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Dermatology', 'جلد کے امراض', 'doctor', 'dermatology'
)
on conflict (id) do nothing;

insert into public.practitioner_specialties (practitioner_id, specialty_id)
values (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
)
on conflict do nothing;

insert into public.clinics (
  id, slug, owner_practitioner_id, name, city, area, address, phone
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'khan-skin-clinic-gulberg',
  '11111111-1111-1111-1111-111111111111',
  'Khan Skin Clinic', 'Lahore', 'Gulberg', '12 Main Boulevard, Gulberg III, Lahore',
  '+924235123456'
)
on conflict (id) do nothing;

insert into public.practitioner_clinic (
  practitioner_id, clinic_id, consultation_fee, slot_length_minutes,
  daily_patient_cap, timings, is_active, cancellation_window_hours
) values (
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  2500, 20, 40,
  -- Wide 08:00-22:00 PKT window every day of the week (rather than a
  -- realistic evening-only clinic schedule) so local dev/QA always finds
  -- open slots "today" regardless of what time of day someone is testing
  -- the booking flow — availability.ts filters out anything already past
  -- "now", so a narrow window can look empty for hours at a stretch.
  '{
    "mon": [{"start":"08:00","end":"22:00"}],
    "tue": [{"start":"08:00","end":"22:00"}],
    "wed": [{"start":"08:00","end":"22:00"}],
    "thu": [{"start":"08:00","end":"22:00"}],
    "fri": [{"start":"08:00","end":"22:00"}],
    "sat": [{"start":"08:00","end":"22:00"}],
    "sun": [{"start":"08:00","end":"22:00"}]
  }'::jsonb,
  true,
  -- Real clinics default to 24h (see 0002_cancellation_window.sql), but that
  -- makes almost every near-term test booking uncancellable in local
  -- dev/QA — shrunk to 1h here so the cancel flow is actually testable
  -- without needing to book several days out. Local seed data only, not a
  -- change to the real default or to booking.service.ts's enforcement.
  1
)
on conflict (practitioner_id, clinic_id) do nothing;

insert into public.clinic_staff (clinic_id, user_id, role, status)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'owner', 'active'
)
on conflict (clinic_id, user_id) do nothing;

insert into public.clinic_staff (clinic_id, user_id, role, status)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '33333333-3333-3333-3333-333333333333',
  'receptionist', 'active'
)
on conflict (clinic_id, user_id) do nothing;
