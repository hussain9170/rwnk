create table public.purchase_marketing_attribution (
  purchase_id uuid primary key references public.purchases(id) on delete cascade,
  consent_id uuid not null,
  source text not null check (source = 'snapchat'),
  medium text not null check (medium in ('paid_social', 'organic')),
  account_id uuid,
  campaign text,
  content text,
  acquired_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index purchase_marketing_attribution_consent_idx on public.purchase_marketing_attribution (consent_id);
create table public.snap_reporting_settings (
  organization_id uuid primary key check (organization_id = '54c2bdfb-3c68-4b72-af12-019ae7d424a6'),
  usd_kwd_rate numeric check (usd_kwd_rate > 0 and usd_kwd_rate <= 10),
  payment_fee_percent numeric check (payment_fee_percent between 0 and 100),
  payment_fee_fixed_kwd numeric check (payment_fee_fixed_kwd between 0 and 100000),
  operating_cost_kwd_daily numeric check (operating_cost_kwd_daily between 0 and 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table public.snap_report_snapshots (
  account_id uuid not null,
  period_days integer not null check (period_days in (1, 7, 30)),
  generated_at timestamptz not null,
  report jsonb not null,
  primary key(account_id, period_days)
);
alter table public.purchase_marketing_attribution enable row level security;
alter table public.snap_reporting_settings enable row level security;
alter table public.snap_report_snapshots enable row level security;
revoke all on public.purchase_marketing_attribution, public.snap_reporting_settings, public.snap_report_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.purchase_marketing_attribution, public.snap_reporting_settings, public.snap_report_snapshots to service_role;
