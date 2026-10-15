-- No backfill: only new checkouts with explicit Snap consent enter this queue.
create table public.snap_purchase_outbox (
  purchase_id uuid primary key references public.purchases(id) on delete cascade,
  consent_id uuid not null,
  consent_version text not null check (consent_version = 'snap-v1'),
  consent_at timestamptz not null,
  sc_click_id text,
  sc_cookie1 text,
  revoked_at timestamptz,
  sent_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  last_http_status integer,
  created_at timestamptz not null default now()
);
alter table public.snap_purchase_outbox enable row level security;
revoke all on public.snap_purchase_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.snap_purchase_outbox to service_role;
create index snap_outbox_consent_idx on public.snap_purchase_outbox(consent_id);

create function public.claim_snap_purchases(p_purchase_id uuid default null)
returns setof public.snap_purchase_outbox
language sql security invoker set search_path = '' as $$
  update public.snap_purchase_outbox o
  set lease_id = gen_random_uuid(), lease_until = now() + interval '10 minutes', attempts = o.attempts + 1
  where o.purchase_id in (
    select q.purchase_id from public.snap_purchase_outbox q
    join public.purchases p on p.id = q.purchase_id
    where (p_purchase_id is null or q.purchase_id = p_purchase_id)
      and p.status = 'completed' and p.paid_at > now() - interval '6 days'
      and q.sent_at is null and q.revoked_at is null and q.attempts < 20
      and (q.lease_until is null or q.lease_until < now())
    order by p.paid_at limit 20 for update of q skip locked
  ) returning o.*;
$$;
revoke all on function public.claim_snap_purchases(uuid) from public, anon, authenticated;
grant execute on function public.claim_snap_purchases(uuid) to service_role;
