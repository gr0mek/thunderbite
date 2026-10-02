# DBA — index [DISCOVERED]
- Extension: chrome.storage.local (watches, settings, siteHealth, scan log ring buffer of 100) + IndexedDB `offers` and `prices` (DB v2, 30-day retention, housekeeping purge).
- Backend: Postgres (Supabase) table `subscribers` (migrations/0001) keyed by email with verify/unsubscribe tokens; no user accounts.
