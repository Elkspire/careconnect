-- "Nasreen takes the vitals. Dr. Hamza Tariq consults, but never issues a
-- prescription alone." (journeys.html, "Assistant & junior" track). A
-- distinct front-desk-adjacent role: can record vitals and attach reports,
-- explicitly cannot ever reach the prescription pad or clinical notes —
-- clinical_notes/prescription_items RLS policies never reference
-- clinic_staff at all, so this stays true structurally, not just by
-- omission here. In its own migration: a new enum value can't be used
-- (e.g. in a policy referencing it) inside the same transaction that adds
-- it, so 0017_vitals.sql is a separate migration on purpose.

alter type clinic_staff_role add value 'assistant';
