-- Roman Urdu (Urdu written in Latin letters) as a third language, next to
-- English and Urdu script. 'ur-Latn' is its standard BCP 47 tag and matches
-- the web app's locale/URL prefix and message file name, so a patient's
-- saved preference and the site's language use the same value.
alter type preferred_language add value if not exists 'ur-Latn';
