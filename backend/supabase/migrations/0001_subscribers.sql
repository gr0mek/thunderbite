-- Subscribers: one row per email address that has ever asked to be
-- notified. No user accounts (uxSmartBuy.md §5.6 footer: "Wypisz się" is a
-- one-time link, no login) — status + the two opaque tokens are all the
-- state the backend needs. Everything else (which watch, which offers, how
-- often) stays on the extension side and is only ever sent per-request
-- (startSmartBuy.md §6 rule 18: backend gets nothing but what a given email
-- needs — the address and the offer list for that one send).
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'unsubscribed')),
  verify_token text unique,
  unsubscribe_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists subscribers_email_idx on subscribers (email);

-- Row Level Security: these tables are only ever touched by Edge Functions
-- using the service-role key (which bypasses RLS), never directly by a
-- client. Enabling RLS with no policies means even a leaked anon key can't
-- read or write this table directly.
alter table subscribers enable row level security;
