-- Server-only limits and durable payment/email coordination. No customer
-- rows are deleted and no old confirmation emails are queued retrospectively.
create table public.request_limits (
  key text primary key, window_start timestamptz not null, hits integer not null
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public, anon, authenticated;
grant all on public.request_limits to service_role;
create function public.allow_request(p_key text, p_max integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_hits integer;
begin
  insert into public.request_limits values(p_key, now(), 1)
  on conflict(key) do update set
    hits = case when request_limits.window_start < now()-make_interval(secs=>p_seconds) then 1 else request_limits.hits+1 end,
    window_start = case when request_limits.window_start < now()-make_interval(secs=>p_seconds) then now() else request_limits.window_start end
  returning hits into v_hits;
  if random() < 0.01 then delete from public.request_limits where window_start < now()-interval '1 day'; end if;
  return v_hits <= p_max;
end $$;
revoke execute on function public.allow_request(text,integer,integer) from public, anon, authenticated;
grant execute on function public.allow_request(text,integer,integer) to service_role;

create table public.purchase_email_outbox (
  purchase_id uuid primary key references public.purchases(id),
  payload jsonb, created_at timestamptz not null default now(),
  first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
  lease_until timestamptz, attempts integer not null default 0,
  sent_at timestamptz, last_error text
);
alter table public.purchase_email_outbox enable row level security;
revoke all on public.purchase_email_outbox from public,anon,authenticated;
grant all on public.purchase_email_outbox to service_role;
create function public.queue_purchase_email() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    insert into public.purchase_email_outbox(purchase_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.queue_purchase_email() from public,anon,authenticated;
grant execute on function public.queue_purchase_email() to service_role;
create trigger queue_purchase_email after update of status on public.purchases for each row execute function public.queue_purchase_email();
create function public.claim_purchase_emails(p_purchase_id uuid default null)
returns setof public.purchase_email_outbox language sql security invoker set search_path = '' as $$
  update public.purchase_email_outbox o set lease_until=now()+interval '2 minutes',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now())
  where o.purchase_id in (
    select q.purchase_id from public.purchase_email_outbox q
    where q.sent_at is null and q.attempts < 5 and q.next_attempt_at<=now()
      and (q.first_attempt_at is null or q.first_attempt_at>now()-interval '23 hours')
      and (q.lease_until is null or q.lease_until<now())
      and (p_purchase_id is null or q.purchase_id=p_purchase_id)
    order by q.created_at limit 10 for update skip locked
  ) returning o.*;
$$;
revoke execute on function public.claim_purchase_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_purchase_emails(uuid) to service_role;

create index if not exists download_tokens_purchase_id_idx on public.download_tokens(purchase_id);
create index if not exists download_tokens_user_id_idx on public.download_tokens(user_id);
create index if not exists downloads_purchase_id_idx on public.downloads(purchase_id);
create index if not exists downloads_user_id_idx on public.downloads(user_id);
create index if not exists purchases_product_id_idx on public.purchases(product_id);
create index if not exists purchases_user_id_idx on public.purchases(user_id);
create index if not exists admin_invitations_invited_by_idx on public.admin_invitations(invited_by);
create index if not exists admin_users_invited_by_idx on public.admin_users(invited_by);
