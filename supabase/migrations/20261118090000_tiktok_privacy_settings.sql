create table public.tiktok_consent_receipts (
  id uuid primary key default gen_random_uuid(),
  version text not null check (version = 'tiktok-settings-v1'),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  revoked_at timestamptz
);
alter table public.tiktok_consent_receipts enable row level security;
revoke all on public.tiktok_consent_receipts from public, anon, authenticated;
grant select, insert, update on public.tiktok_consent_receipts to service_role;

alter table public.tiktok_purchase_outbox
  add column settings_consent_id uuid references public.tiktok_consent_receipts(id),
  drop constraint tiktok_purchase_outbox_consent_version_check,
  add constraint tiktok_purchase_outbox_consent_version_check check (
    (consent_version = 'tiktok-purchase-v1' and settings_consent_id is null) or
    (consent_version = 'tiktok-settings-v1' and settings_consent_id is not null)
  );

create or replace function public.claim_tiktok_purchases(p_purchase_id uuid default null)
returns setof public.tiktok_purchase_outbox
language sql security invoker set search_path = '' as $$
  update public.tiktok_purchase_outbox o
  set lease_id = gen_random_uuid(), lease_until = now() + interval '10 minutes', attempts = o.attempts + 1
  where o.purchase_id in (
    select q.purchase_id from public.tiktok_purchase_outbox q
    join public.purchases p on p.id = q.purchase_id
    where (p_purchase_id is null or q.purchase_id = p_purchase_id)
      and p.status = 'completed' and p.paid_at > now() - interval '6 days'
      and q.consent_at <= p.paid_at
      and (q.settings_consent_id is null or exists (
        select from public.tiktok_consent_receipts c
        where c.id = q.settings_consent_id and c.revoked_at is null and c.expires_at > now()
      ))
      and q.sent_at is null and q.revoked_at is null and q.attempts < 20
      and (q.lease_until is null or q.lease_until < now())
    order by p.paid_at limit 10 for update of q skip locked
  ) returning o.*;
$$;
