-- =====================================================================
-- MuneemX — PIN hardening
-- * Internal helpers can no longer be called from the app.
-- * Approval PINs are checked in ONE place (verify_approval), which
--   locks an approver after 5 wrong PINs in 15 minutes and, on success,
--   issues a one-time token valid for 5 minutes. Bills, voids and salary
--   accept that token instead of the PIN.
-- =====================================================================

create table if not exists public.pin_failures (
  id         bigserial primary key,
  member_id  uuid not null references public.members(id) on delete cascade,
  ts         timestamptz not null default now()
);
create index if not exists pin_failures_member_ts on public.pin_failures (member_id, ts);

create table if not exists public.approval_tokens (
  token         uuid primary key default gen_random_uuid(),
  approver      uuid not null references public.members(id) on delete cascade,
  requested_by  uuid not null references public.members(id) on delete cascade,
  expires_at    timestamptz not null default now() + interval '5 minutes',
  used          boolean not null default false
);
alter table public.pin_failures    enable row level security;
alter table public.approval_tokens enable row level security;
-- (no policies: only the functions below touch these tables)

-- returns a one-time approval token, or null if the PIN is wrong
drop function if exists public.verify_approval(uuid, uuid, text);
create function public.verify_approval(p_shop uuid, p_approver uuid, p_pin text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare me public.members; a public.members; fails int; tok uuid;
begin
  me := public._require_member();
  select * into a from public.members where id = p_approver and tenant_id = me.tenant_id and active;
  if a.id is null or not (a.role = 'owner' or (a.role = 'manager' and (p_shop is null or a.shop_id = p_shop))) then
    return null;
  end if;
  select count(*) into fails from public.pin_failures where member_id = a.id and ts > now() - interval '15 minutes';
  if fails >= 5 then raise exception 'Too many wrong PINs for %. Try again in 15 minutes.', a.name; end if;
  if not exists (select 1 from public.member_secrets where member_id = a.id and pin_hash = extensions.crypt(coalesce(p_pin,''), pin_hash)) then
    insert into public.pin_failures (member_id) values (a.id);
    insert into public.audit_log (tenant_id, member_id, user_id, action, detail)
      values (me.tenant_id, me.id, auth.uid(), 'Wrong approval PIN', 'for ' || a.name);
    return null;
  end if;
  delete from public.approval_tokens where expires_at < now() - interval '1 day';
  insert into public.approval_tokens (approver, requested_by) values (a.id, me.id) returning token into tok;
  return tok::text;
end $$;

-- consume a token (called inside lock_sale / void_sale / pay_salary)
create or replace function public._approve(p_tenant uuid, p_shop uuid, p_approver uuid, p_pin text)
returns public.members language plpgsql security definer set search_path = public as $$
declare a public.members; t uuid;
begin
  select * into a from public.members where id = p_approver and tenant_id = p_tenant and active;
  if a.id is null or not (a.role = 'owner' or (a.role = 'manager' and (p_shop is null or a.shop_id = p_shop))) then
    raise exception 'Approver is not allowed for this shop' using errcode = '42501';
  end if;
  -- p_pin now carries the one-time token issued by verify_approval
  begin t := p_pin::uuid; exception when others then t := null; end;
  update public.approval_tokens set used = true
   where token = t and approver = a.id and requested_by = public.my_member_id() and not used and expires_at > now()
   returning token into t;
  if t is null then raise exception 'Approval expired — ask the manager to enter the PIN again' using errcode = '28P01'; end if;
  return a;
end $$;

-- internal helpers: not callable from the app
revoke execute on function public._approve(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public._check_pin(uuid, text) from public, anon, authenticated;
revoke execute on function public._audit(uuid, text, text) from public, anon, authenticated;
revoke execute on function public._require_member() from public, anon, authenticated;
revoke execute on function public._guard_tenant() from public, anon, authenticated;
grant execute on function public.verify_approval(uuid, uuid, text) to authenticated;
revoke execute on function public.verify_approval(uuid, uuid, text) from public, anon;
