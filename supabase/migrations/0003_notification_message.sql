-- Stores the rendered message text so the in-app feed has something to
-- display without re-deriving it from event_type client-side. Additive —
-- 0001/0002 already shipped conceptually, don't edit them in place.

alter table notification_log
  add column message text;
