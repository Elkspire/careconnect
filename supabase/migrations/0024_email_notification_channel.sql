-- Staff invites now also go out by email (EmailAdapter), and every
-- delivery attempt is logged per channel in notification_log — so the
-- channel enum needs an 'email' value before the API can write those rows.
alter type notification_channel add value if not exists 'email';
