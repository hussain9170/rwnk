-- Server-only encrypted OAuth credentials. No browser/client role may read
-- tokens or pending state, including signed-in administrators.
create table public.snap_marketing_connections (
  organization_id uuid primary key check (organization_id = '54c2bdfb-3c68-4b72-af12-019ae7d424a6'),
  token_ciphertext text not null,
  expires_at timestamptz not null,
  connected_by uuid not null references auth.users(id),
  connected_at timestamptz not null default now(),
  version uuid not null,
  refresh_lock_until timestamptz
);
create table public.snap_marketing_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  admin_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index snap_marketing_oauth_states_expiry_idx on public.snap_marketing_oauth_states (expires_at);
alter table public.snap_marketing_connections enable row level security;
alter table public.snap_marketing_oauth_states enable row level security;
revoke all on public.snap_marketing_connections, public.snap_marketing_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.snap_marketing_connections, public.snap_marketing_oauth_states to service_role;
