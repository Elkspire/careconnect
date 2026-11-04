-- Self-service account deletion (AccountService.deleteAccount in apps/api).
--
-- 1. "Who did this" columns stop blocking deletion. They referenced
--    auth.users with no ON DELETE action, so deleting any user who had ever
--    booked, uploaded, written a note, etc. failed with a foreign-key error.
--    They become nullable and ON DELETE SET NULL: the clinic's record stays,
--    it just no longer names an author who has deleted their account.
--    notification_log rows are the deleted user's own inbox, so they go with
--    the user (ON DELETE CASCADE).
--
-- 2. A patient row can outlive its login. patients.id referenced auth.users
--    ON DELETE CASCADE, so deleting a patient's login also deleted the
--    patient and — through their own cascades — every appointment, clinical
--    note, prescription and vital the clinic holds for them. Deleted
--    patients are instead anonymised and kept (deleted_at set), so this FK
--    is dropped. practitioners keeps its cascade: deleting a doctor's account
--    removing their profile and clinic is the intended behaviour.

do $$
declare
  spec record;
  fk_name text;
begin
  for spec in
    select * from (values
      ('appointments',        'booked_by_user_id',    'set null'),
      ('appointments',        'cancelled_by_user_id', 'set null'),
      ('clinical_notes',      'created_by',           'set null'),
      ('clinic_staff',        'invited_by',           'set null'),
      ('patient_records',     'uploaded_by',          'set null'),
      ('audit_log',           'actor_user_id',        'set null'),
      ('notification_log',    'recipient_user_id',    'cascade'),
      ('medical_summaries',   'updated_by',           'set null'),
      ('patient_assignments', 'assigned_by',          'set null'),
      ('vitals',              'recorded_by',          'set null'),
      ('record_shares',       'created_by',           'set null')
    ) as t(tbl, col, on_delete)
  loop
    -- The existing FK's name, looked up rather than assumed.
    select con.conname into fk_name
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.conrelid = format('public.%I', spec.tbl)::regclass
      and con.confrelid = 'auth.users'::regclass
      and att.attname = spec.col;

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', spec.tbl, fk_name);
    end if;

    if spec.on_delete = 'set null' then
      execute format('alter table public.%I alter column %I drop not null', spec.tbl, spec.col);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete %s',
      spec.tbl, spec.tbl || '_' || spec.col || '_fkey', spec.col, spec.on_delete
    );
  end loop;
end $$;

-- patients.id -> auth.users: drop the cascade so anonymised patients remain.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where contype = 'f'
    and conrelid = 'public.patients'::regclass
    and confrelid = 'auth.users'::regclass;
  if fk_name is not null then
    execute format('alter table public.patients drop constraint %I', fk_name);
  end if;
end $$;

-- When set, the patient deleted their account: personal details are wiped
-- and the row only anchors the clinic's records ("Deleted patient").
alter table public.patients add column if not exists deleted_at timestamptz;
