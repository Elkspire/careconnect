-- The family member form now asks for the specific relationship (husband/
-- wife, son/daughter, mother/father) instead of the generic spouse/child/
-- parent buckets those replace in the UI. Additive migration — 0001 already
-- shipped conceptually, don't edit it in place. Existing enum values are
-- left in place (Postgres enums don't support dropping values, and any
-- pre-existing rows using them must stay valid).

alter type family_relationship add value if not exists 'husband';
alter type family_relationship add value if not exists 'wife';
alter type family_relationship add value if not exists 'son';
alter type family_relationship add value if not exists 'daughter';
alter type family_relationship add value if not exists 'mother';
alter type family_relationship add value if not exists 'father';
