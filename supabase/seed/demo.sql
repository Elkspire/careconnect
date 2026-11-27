-- Demo data for testing the app by hand locally, on top of seed.sql.
-- Applied by `pnpm dev:local` (scripts/dev-local.mjs) every time it starts,
-- so it must stay safe to run repeatedly. Each run moves the demo queue to
-- today: demo appointments are deleted (with their vitals and notes) and
-- re-created around the current time.
--
-- What it adds, all signing in with OTP 123456 (supabase/config.toml):
--   +923001110000  platform admin (no clinic)
--   +923005556666  junior doctor at Khan Skin Clinic, assigned two patients
--   Dr. Ayesha Khan (+923001234567) also owns a second branch, DHA
--   A queue at both branches for today, in mixed states
--
-- Local only: never run this against a hosted database.

-- ---- sign-in identities (skipped if that phone already has an account) ----
do $$
declare
  demo record;
begin
  for demo in
    select * from (values
      ('923001110000', '44444444-4444-4444-4444-444444444444'::uuid),
      ('923005556666', '55555555-5555-5555-5555-555555555555'::uuid)
    ) as v(phone, id)
  loop
    if not exists (select 1 from auth.users where phone = demo.phone) then
      -- Same column set as seed.sql (see the note there on the four tokens).
      insert into auth.users (
        instance_id, id, aud, role, phone, phone_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', demo.id,
        'authenticated', 'authenticated', demo.phone, now(),
        now(), now(), '{"provider":"phone","providers":["phone"]}', '{}',
        false, false,
        '', '', '', ''
      );
    end if;
  end loop;
end $$;

insert into public.platform_admins (id)
select id from auth.users where phone = '923001110000'
on conflict do nothing;

-- ---- a second branch, so the clinic sidebar's branch switcher has a choice ----
insert into public.clinics (
  id, slug, owner_practitioner_id, name, city, area, address, phone
) values (
  'cccccccc-0000-0000-0000-0000000000d5',
  'khan-skin-clinic-dha',
  '11111111-1111-1111-1111-111111111111',
  'Khan Skin Clinic DHA', 'Lahore', 'DHA Phase 5', '12 Y Block, DHA Phase 5, Lahore',
  '+924235987654'
)
on conflict (id) do update set
  owner_practitioner_id = excluded.owner_practitioner_id,
  name = excluded.name, area = excluded.area, address = excluded.address;

insert into public.practitioner_clinic (
  practitioner_id, clinic_id, consultation_fee, slot_length_minutes,
  daily_patient_cap, timings, is_active, cancellation_window_hours
)
select
  '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-0000000000d5',
  3000, 20, 30, timings, true, 1
from public.practitioner_clinic
where practitioner_id = '11111111-1111-1111-1111-111111111111'
  and clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
on conflict (practitioner_id, clinic_id) do nothing;

insert into public.clinic_staff (clinic_id, user_id, role, status)
values ('cccccccc-0000-0000-0000-0000000000d5', '11111111-1111-1111-1111-111111111111', 'owner', 'active')
on conflict (clinic_id, user_id) do update set role = 'owner', status = 'active';

-- ---- a junior doctor at Khan Skin Clinic (Gulberg) ----
-- (The old 'assistant' role was folded into junior_doctor; see schema.ts.)
insert into public.clinic_staff (clinic_id, user_id, role, status)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 'junior_doctor', 'active'
from auth.users where phone = '923005556666'
on conflict (clinic_id, user_id) do update set role = 'junior_doctor', status = 'active';

-- ---- demo patients (no sign-in of their own; they only appear in clinic queues) ----
insert into public.patients (id, full_name, gender, dob, preferred_language) values
  ('dddddddd-0000-0000-0000-000000000001', 'Muhammad Imran Qureshi', 'male', '1968-03-14', 'ur'),
  ('dddddddd-0000-0000-0000-000000000002', 'Ayesha Siddiqui', 'female', '2000-07-02', 'en'),
  ('dddddddd-0000-0000-0000-000000000003', 'Zubaida Khan', 'female', '1955-11-20', 'ur'),
  ('dddddddd-0000-0000-0000-000000000004', 'Hamza Raza', 'male', '1991-01-09', 'ur-Latn'),
  ('dddddddd-0000-0000-0000-000000000005', 'Sana Malik', 'female', '1987-05-27', 'en')
on conflict (id) do nothing;

insert into public.patient_assignments (clinic_id, junior_doctor_user_id, patient_id)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', u.id, p.id
from auth.users u
cross join (values ('dddddddd-0000-0000-0000-000000000001'::uuid), ('dddddddd-0000-0000-0000-000000000002'::uuid)) as p(id)
where u.phone = '923005556666'
  and not exists (
    select 1 from public.patient_assignments a
    where a.clinic_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and a.junior_doctor_user_id = u.id and a.patient_id = p.id
  );

-- ---- today's queue, re-created around the current time ----
delete from public.appointments where id::text like 'eeeeeeee-0000-0000-0000-%';

with slot as (
  -- The current 20-minute slot, and today's bounds, in Pakistan time.
  select
    date_bin('20 minutes', now(), day_start) as base,
    day_start
  from (select (date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi') as day_start) d
),
demo (id, patient_id, clinic_id, minutes, status) as (values
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, -100, 'completed'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -40, 'checked_in'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -20, 'checked_in'),
  ('eeeeeeee-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 20, 'booked'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 60, 'booked'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -60, 'no_show'),
  ('eeeeeeee-0000-0000-0000-000000000007', 'dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-0000000000d5', -20, 'checked_in'),
  ('eeeeeeee-0000-0000-0000-000000000008', 'dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-0000000000d5', 40, 'booked')
)
insert into public.appointments (
  id, patient_id, practitioner_id, clinic_id, scheduled_start, scheduled_end, status, booked_by_user_id
)
select
  demo.id, demo.patient_id, '11111111-1111-1111-1111-111111111111', demo.clinic_id,
  start_at, start_at + interval '20 minutes', demo.status::public.appointment_status,
  '11111111-1111-1111-1111-111111111111'
from demo, slot,
  -- Kept inside today, so testing just after midnight or late at night
  -- still shows the whole queue on the Today page.
  lateral (select least(greatest(slot.base + make_interval(mins => demo.minutes), slot.day_start + interval '30 minutes'),
                        slot.day_start + interval '23 hours 20 minutes') as start_at) t;
