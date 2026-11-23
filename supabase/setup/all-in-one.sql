-- MuneemX — ALL MIGRATIONS IN ONE FILE (paste into Supabase → SQL Editor → Run, once)

-- >>> 20261123000001_schema.sql
-- =====================================================================
-- MuneemX — core schema (multi-tenant, white-label liquor retail OS)
-- Run in Supabase: SQL Editor → paste each migration in order → Run.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- tenants (one per client business) ----------
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name        text not null,
  tagline     text default '',
  color       text not null default '#6d28d9',
  logo        text not null default 'MX',
  type        text not null default 'Individual shop',
  plan        text not null default 'Starter',
  city        text default '',
  status      text not null default 'active',
  footer      text default 'Please drink responsibly. Sale to persons below the legal age is prohibited.',
  policies    jsonb not null default '{"requireScan":true,"override":true,"mrpLock":true,"stockLock":true,"ageCheck":true,"ageLimit":21}',
  created_at  timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- shops ----------
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  code        text not null,
  address     text default '',
  license     text default '',
  upi         text default '',
  seq         integer not null default 0,
  last_hash   text not null default '0000000000000000',
  created_at  timestamptz not null default now(),
  unique (tenant_id, code)
);

-- ---------- members (staff & owners; one membership per login) ----------
create table if not exists public.members (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  user_id            uuid unique references auth.users(id) on delete set null,
  name               text not null,
  username           text not null check (username ~ '^[a-z0-9][a-z0-9._-]{1,30}$'),
  role               text not null check (role in ('owner','manager','salesman')),
  shop_id            uuid references public.shops(id) on delete set null,
  phone              text default '',
  salary             numeric(12,2) not null default 0,
  commission         numeric(5,2) not null default 0,
  active             boolean not null default true,
  joined_at          timestamptz not null default now(),
  unique (tenant_id, username)
);

-- approval PINs live in their own table with no read policy at all
create table if not exists public.member_secrets (
  member_id  uuid primary key references public.members(id) on delete cascade,
  pin_hash   text not null
);

-- ---------- products (tenant_id null = MuneemX master catalog) ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  brand       text not null,
  name        text not null default '',
  category    text not null,
  pack        text not null,
  size_ml     integer not null default 0,
  mrp         numeric(10,2) not null check (mrp >= 0),
  cost        numeric(10,2) not null default 0,
  barcode     text not null,
  popularity  numeric not null default 1,
  source      text not null default 'manual',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists products_barcode_scope
  on public.products (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), barcode);

-- ---------- stock (current quantity per shop & product) ----------
create table if not exists public.stock (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  qty         integer not null default 0,
  primary key (shop_id, product_id)
);

-- ---------- sales (locked bills) ----------
create table if not exists public.sales (
  id           uuid primary key default gen_random_uuid(),
  bill_no      text not null,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  shop_id      uuid not null references public.shops(id) on delete cascade,
  member_id    uuid not null references public.members(id),
  ts           timestamptz not null default now(),
  total        numeric(12,2) not null,
  cost         numeric(12,2) not null,
  mode         text not null check (mode in ('Cash','UPI','Split')),
  cash         numeric(12,2) not null default 0,
  upi          numeric(12,2) not null default 0,
  upi_ref      text default '',
  status       text not null default 'locked' check (status in ('locked','void')),
  prev_hash    text not null,
  hash         text not null,
  void_by      uuid references public.members(id),
  void_reason  text,
  void_ts      timestamptz,
  unique (shop_id, bill_no)
);
create index if not exists sales_tenant_ts on public.sales (tenant_id, ts desc);
create index if not exists sales_shop_ts on public.sales (shop_id, ts);

create table if not exists public.sale_items (
  id          bigserial primary key,
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  qty         integer not null check (qty > 0),
  price       numeric(10,2) not null,
  cost        numeric(10,2) not null,
  method      text not null check (method in ('scan','ai','ovr','man'))
);
create index if not exists sale_items_sale on public.sale_items (sale_id);

-- ---------- stock movements (opening, inward, transfer, adjust) ----------
create table if not exists public.stock_moves (
  id          bigserial primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  qty         integer not null,
  type        text not null check (type in ('opening','inward','transfer','adjust')),
  ref         text default '',
  party       text default '',
  member_id   uuid references public.members(id),
  ts          timestamptz not null default now()
);
create index if not exists stock_moves_shop_ts on public.stock_moves (shop_id, ts);

-- ---------- expenses ----------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  ts          timestamptz not null default now(),
  category    text not null,
  amount      numeric(12,2) not null check (amount > 0),
  note        text default '',
  mode        text not null default 'Cash' check (mode in ('Cash','UPI','Bank')),
  member_id   uuid references public.members(id)
);
create index if not exists expenses_shop_ts on public.expenses (shop_id, ts);

-- ---------- staff: attendance, advances, payroll ----------
create table if not exists public.attendance (
  member_id   uuid not null references public.members(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  day         date not null,
  status      text not null check (status in ('P','H','A')),
  primary key (member_id, day)
);

create table if not exists public.advances (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  ts          timestamptz not null default now(),
  amount      numeric(12,2) not null check (amount > 0),
  note        text default ''
);

create table if not exists public.payroll (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  net         numeric(12,2) not null,
  approved_by uuid references public.members(id),
  ts          timestamptz not null default now(),
  unique (member_id, month)
);

-- ---------- day close ----------
create table if not exists public.day_closings (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  day         date not null,
  expected    numeric(12,2) not null,
  counted     numeric(12,2) not null,
  variance    numeric(12,2) not null,
  member_id   uuid references public.members(id),
  ts          timestamptz not null default now(),
  unique (shop_id, day)
);

-- ---------- audit trail ----------
create table if not exists public.audit_log (
  id          bigserial primary key,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  ts          timestamptz not null default now(),
  member_id   uuid references public.members(id),
  user_id     uuid,
  action      text not null,
  detail      text default ''
);
create index if not exists audit_tenant_ts on public.audit_log (tenant_id, ts desc);

-- >>> 20261123000002_security.sql
-- =====================================================================
-- MuneemX — helper functions & row-level security
-- Every table is locked down. Reads go through RLS; risky writes
-- (bills, stock, salary) only through SECURITY DEFINER functions.
-- =====================================================================

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.my_member() returns public.members
language sql stable security definer set search_path = public as $$
  select * from public.members where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.my_tenant() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.members where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.my_shop() returns uuid
language sql stable security definer set search_path = public as $$
  select shop_id from public.members where user_id = auth.uid() and active limit 1;
$$;

-- can the caller see this shop's data at all?
create or replace function public.can_see_shop(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.shops s join public.members m on m.tenant_id = s.tenant_id
    where s.id = p_shop and m.user_id = auth.uid() and m.active
      and (m.role = 'owner' or m.shop_id = s.id));
$$;

-- can the caller manage this shop (owner, or manager of that shop)?
create or replace function public.can_manage_shop(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shops s join public.members m on m.tenant_id = s.tenant_id
    where s.id = p_shop and m.user_id = auth.uid() and m.active
      and (m.role = 'owner' or (m.role = 'manager' and m.shop_id = s.id)));
$$;

create or replace function public.can_manage_member(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members t join public.members m on m.tenant_id = t.tenant_id
    where t.id = p_member and m.user_id = auth.uid() and m.active
      and (m.role = 'owner' or (m.role = 'manager' and m.shop_id = t.shop_id)));
$$;

-- ---------------- enable RLS everywhere ----------------
alter table public.tenants         enable row level security;
alter table public.platform_admins enable row level security;
alter table public.shops           enable row level security;
alter table public.members         enable row level security;
alter table public.member_secrets  enable row level security;
alter table public.products        enable row level security;
alter table public.stock           enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.stock_moves     enable row level security;
alter table public.expenses        enable row level security;
alter table public.attendance      enable row level security;
alter table public.advances        enable row level security;
alter table public.payroll         enable row level security;
alter table public.day_closings    enable row level security;
alter table public.audit_log       enable row level security;

-- tenants
create policy tenants_read on public.tenants for select
  using (id = public.my_tenant() or public.is_platform_admin());
create policy tenants_owner_update on public.tenants for update
  using (id = public.my_tenant() and public.my_role() = 'owner')
  with check (id = public.my_tenant());
create policy tenants_admin_update on public.tenants for update
  using (public.is_platform_admin()) with check (true);

create policy admins_self on public.platform_admins for select using (user_id = auth.uid());

-- shops
create policy shops_read on public.shops for select
  using (tenant_id = public.my_tenant() or public.is_platform_admin());
create policy shops_owner_insert on public.shops for insert
  with check (tenant_id = public.my_tenant() and public.my_role() = 'owner');
create policy shops_owner_update on public.shops for update
  using (tenant_id = public.my_tenant() and public.my_role() = 'owner')
  with check (tenant_id = public.my_tenant());

-- members (PIN hashes are in member_secrets, which has RLS on and no policies)
create policy members_read on public.members for select
  using (tenant_id = public.my_tenant() or public.is_platform_admin());
create policy members_owner_update on public.members for update
  using (tenant_id = public.my_tenant() and public.my_role() = 'owner')
  with check (tenant_id = public.my_tenant());

-- products
create policy products_read on public.products for select
  using (tenant_id is null or tenant_id = public.my_tenant() or public.is_platform_admin());
create policy products_insert on public.products for insert
  with check (tenant_id = public.my_tenant() and public.my_role() in ('owner','manager'));
create policy products_update on public.products for update
  using (tenant_id = public.my_tenant() and public.my_role() in ('owner','manager'))
  with check (tenant_id = public.my_tenant());
create policy products_admin_master on public.products for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- stock (writes only via functions)
create policy stock_read on public.stock for select using (public.can_see_shop(shop_id));

-- sales
create policy sales_read on public.sales for select using (
  public.is_platform_admin() or (
    tenant_id = public.my_tenant() and (
      public.my_role() = 'owner'
      or (public.my_role() = 'manager' and shop_id = public.my_shop())
      or (public.my_role() = 'salesman' and member_id = public.my_member_id()))));
create policy sale_items_read on public.sale_items for select
  using (exists (select 1 from public.sales s where s.id = sale_id));

-- stock moves
create policy moves_read on public.stock_moves for select
  using (public.can_manage_shop(shop_id) or public.is_platform_admin());

-- expenses
create policy expenses_read on public.expenses for select
  using (public.can_manage_shop(shop_id) or public.is_platform_admin());
create policy expenses_insert on public.expenses for insert
  with check (public.can_manage_shop(shop_id) and tenant_id = public.my_tenant()
              and member_id = public.my_member_id());

-- attendance
create policy att_read on public.attendance for select
  using (public.can_manage_member(member_id) or member_id = public.my_member_id() or public.is_platform_admin());
create policy att_write on public.attendance for insert
  with check (public.can_manage_member(member_id) and tenant_id = public.my_tenant());
create policy att_update on public.attendance for update
  using (public.can_manage_member(member_id)) with check (public.can_manage_member(member_id));

-- advances
create policy adv_read on public.advances for select
  using (public.can_manage_member(member_id) or member_id = public.my_member_id() or public.is_platform_admin());
create policy adv_insert on public.advances for insert
  with check (public.can_manage_member(member_id) and tenant_id = public.my_tenant());

-- payroll (insert via pay_salary)
create policy pay_read on public.payroll for select
  using (public.can_manage_member(member_id) or member_id = public.my_member_id() or public.is_platform_admin());

-- day closings
create policy close_read on public.day_closings for select
  using (public.can_manage_shop(shop_id) or public.is_platform_admin());
create policy close_insert on public.day_closings for insert
  with check (public.can_manage_shop(shop_id) and tenant_id = public.my_tenant()
              and member_id = public.my_member_id());

-- audit
create policy audit_read on public.audit_log for select using (
  public.is_platform_admin() or (tenant_id = public.my_tenant() and public.my_role() in ('owner','manager')));

-- >>> 20261123000003_functions.sql
-- =====================================================================
-- MuneemX — business functions (called from the app with supabase.rpc)
-- =====================================================================

-- ---------- internal helpers ----------
create or replace function public._audit(p_tenant uuid, p_action text, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (tenant_id, member_id, user_id, action, detail)
  values (p_tenant, public.my_member_id(), auth.uid(), p_action, coalesce(p_detail,''));
$$;

create or replace function public._require_member() returns public.members
language plpgsql stable security definer set search_path = public as $$
declare m public.members;
begin
  select * into m from public.members where user_id = auth.uid() and active limit 1;
  if m.id is null then raise exception 'Not a member of any workspace' using errcode = '42501'; end if;
  return m;
end $$;

create or replace function public._check_pin(p_member uuid, p_pin text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.member_secrets
                 where member_id = p_member and pin_hash = extensions.crypt(p_pin, pin_hash));
$$;

-- approver must be owner of the tenant, or manager of the given shop
create or replace function public._approve(p_tenant uuid, p_shop uuid, p_approver uuid, p_pin text)
returns public.members language plpgsql stable security definer set search_path = public as $$
declare a public.members;
begin
  select * into a from public.members where id = p_approver and tenant_id = p_tenant and active;
  if a.id is null or not (a.role = 'owner' or (a.role = 'manager' and (p_shop is null or a.shop_id = p_shop))) then
    raise exception 'Approver is not allowed for this shop' using errcode = '42501';
  end if;
  if not public._check_pin(a.id, coalesce(p_pin,'')) then
    raise exception 'Wrong approval PIN' using errcode = '28P01';
  end if;
  return a;
end $$;

-- ---------- public: branding for the sign-in page (no login needed) ----------
create or replace function public.workspace_public(p_slug text)
returns table (id uuid, slug text, name text, tagline text, color text, logo text)
language sql stable security definer set search_path = public as $$
  select id, slug, name, tagline, color, logo from public.tenants
  where slug = lower(p_slug) and status = 'active';
$$;
grant execute on function public.workspace_public(text) to anon, authenticated;

-- ---------- create a workspace (self sign-up, or by platform admin) ----------
create or replace function public.create_workspace(
  p_name text, p_slug text, p_city text, p_type text, p_plan text, p_color text,
  p_owner_name text, p_owner_username text, p_owner_pin text, p_first_shop text,
  p_owner_user uuid default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare t uuid; s uuid; m uuid; owner_uid uuid; code text;
begin
  if p_owner_user is not null then
    if not public.is_platform_admin() then raise exception 'Only platform admins can create workspaces for others'; end if;
    owner_uid := p_owner_user;
  else
    owner_uid := auth.uid();
    if owner_uid is null then raise exception 'Sign in first'; end if;
  end if;
  if exists (select 1 from public.members where user_id = owner_uid) then
    raise exception 'This login already belongs to a workspace';
  end if;
  if length(coalesce(p_owner_pin,'')) < 4 then raise exception 'Approval PIN must have at least 4 digits'; end if;

  insert into public.tenants (slug, name, tagline, color, logo, type, plan, city)
  values (lower(p_slug), p_name, coalesce(p_type,'') || case when coalesce(p_city,'') <> '' then ' · ' || p_city else '' end,
          coalesce(nullif(p_color,''),'#6d28d9'),
          upper(left(regexp_replace(initcap(p_name), '[^A-Z]', '', 'g') || 'MX', 2)),
          coalesce(nullif(p_type,''),'Individual shop'), coalesce(nullif(p_plan,''),'Starter'), coalesce(p_city,''))
  returning id into t;

  code := upper(left(regexp_replace(p_name, '[^A-Za-z]', '', 'g') || 'SHP', 3));
  insert into public.shops (tenant_id, name, code, address)
  values (t, coalesce(nullif(p_first_shop,''),'Main shop'), code, coalesce(p_city,'')) returning id into s;

  insert into public.members (tenant_id, user_id, name, username, role)
  values (t, owner_uid, p_owner_name, lower(p_owner_username), 'owner') returning id into m;
  insert into public.member_secrets values (m, extensions.crypt(p_owner_pin, extensions.gen_salt('bf')));

  insert into public.stock (shop_id, product_id, tenant_id, qty)
  select s, p.id, t, 0 from public.products p where p.tenant_id is null;

  insert into public.audit_log (tenant_id, member_id, user_id, action, detail)
  values (t, m, auth.uid(), 'Workspace provisioned', coalesce(p_plan,'Starter'));
  return t;
end $$;

-- ---------- staff ----------
create or replace function public.add_staff(
  p_user uuid, p_name text, p_username text, p_role text, p_shop uuid,
  p_phone text, p_salary numeric, p_commission numeric, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare me public.members; m uuid;
begin
  me := public._require_member();
  if me.role <> 'owner' then raise exception 'Only the owner can add staff'; end if;
  if p_role not in ('manager','salesman') then raise exception 'Role must be manager or salesman'; end if;
  if not exists (select 1 from public.shops where id = p_shop and tenant_id = me.tenant_id) then
    raise exception 'Shop not found in your workspace';
  end if;
  if exists (select 1 from public.members where user_id = p_user) then raise exception 'Login already used'; end if;
  insert into public.members (tenant_id, user_id, name, username, role, shop_id, phone, salary, commission)
  values (me.tenant_id, p_user, p_name, lower(p_username), p_role, p_shop, coalesce(p_phone,''),
          coalesce(p_salary,0), coalesce(p_commission,0)) returning id into m;
  insert into public.member_secrets values (m, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  perform public._audit(me.tenant_id, 'Staff added', p_name || ' (' || p_role || ')');
  return m;
end $$;

create or replace function public.set_approval_pin(p_member uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me public.members;
begin
  me := public._require_member();
  if not (p_member = me.id or (me.role = 'owner' and exists (select 1 from public.members where id = p_member and tenant_id = me.tenant_id))) then
    raise exception 'Not allowed';
  end if;
  insert into public.member_secrets values (p_member, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (member_id) do update set pin_hash = excluded.pin_hash;
  perform public._audit(me.tenant_id, 'Approval PIN changed', p_member::text);
end $$;

create or replace function public.verify_approval(p_shop uuid, p_approver uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public._require_member();
  perform public._approve(me.tenant_id, p_shop, p_approver, p_pin);
  return true;
exception when others then
  return false;
end $$;

-- ---------- billing: lock a sale ----------
-- p_lines: [{"product_id":uuid,"qty":int,"method":"scan|ai|ovr|man"}]
create or replace function public.lock_sale(
  p_shop uuid, p_lines jsonb, p_mode text, p_cash numeric default 0,
  p_upi_ref text default '', p_approver uuid default null, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.members; sh public.shops; pol jsonb; ln jsonb; p public.products;
  q int; meth text; have int; total numeric := 0; cst numeric := 0; has_ovr boolean := false;
  v_cash numeric; v_upi numeric; v_no text; v_ts timestamptz := now(); v_hash text; v_id uuid; items text := '';
begin
  me := public._require_member();
  select * into sh from public.shops where id = p_shop and tenant_id = me.tenant_id for update;
  if sh.id is null then raise exception 'Shop not found'; end if;
  if me.role <> 'owner' and me.shop_id is distinct from p_shop then raise exception 'You can only bill at your own shop'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Bill is empty'; end if;
  if p_mode not in ('Cash','UPI','Split') then raise exception 'Unknown payment mode'; end if;
  select policies into pol from public.tenants where id = me.tenant_id;

  -- validate every line first
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := (ln->>'qty')::int; meth := coalesce(ln->>'method','scan');
    if q is null or q <= 0 then raise exception 'Bad quantity'; end if;
    select * into p from public.products where id = (ln->>'product_id')::uuid
      and (tenant_id is null or tenant_id = me.tenant_id) and active;
    if p.id is null then raise exception 'Product not in database — sale locked'; end if;
    if meth = 'ovr' then has_ovr := true;
    elsif meth = 'man' and coalesce((pol->>'requireScan')::boolean, true) then raise exception 'Scan required for %', p.brand;
    elsif meth not in ('scan','ai','man') then raise exception 'Bad method'; end if;
    if coalesce((pol->>'stockLock')::boolean, true) then
      select coalesce(qty,0) into have from public.stock where shop_id = p_shop and product_id = p.id;
      if coalesce(have,0) < q then raise exception 'Stock lock: only % of % % in stock', coalesce(have,0), p.brand, p.pack; end if;
    end if;
    total := total + p.mrp * q; cst := cst + p.cost * q;   -- price is always MRP (server decides)
    items := items || p.id::text || 'x' || q || '@' || p.mrp || ',';
  end loop;

  if has_ovr then
    if not coalesce((pol->>'override')::boolean, true) then raise exception 'Manual override is disabled'; end if;
    perform public._approve(me.tenant_id, p_shop, p_approver, p_pin);
  end if;

  if p_mode = 'Cash' then v_cash := total; elsif p_mode = 'UPI' then v_cash := 0;
  else
    if coalesce(p_cash,0) <= 0 or p_cash >= total then raise exception 'Split: cash part must be between 0 and the total'; end if;
    v_cash := p_cash;
  end if;
  v_upi := total - v_cash;

  v_no := sh.code || '-' || lpad((sh.seq + 1)::text, 5, '0');
  v_hash := left(encode(extensions.digest(sh.last_hash || '|' || v_no || '|' || (extract(epoch from v_ts)*1000)::bigint
            || '|' || total || '|' || p_mode || '|' || items, 'sha256'), 'hex'), 16);

  insert into public.sales (bill_no, tenant_id, shop_id, member_id, ts, total, cost, mode, cash, upi, upi_ref, prev_hash, hash)
  values (v_no, me.tenant_id, p_shop, me.id, v_ts, total, cst, p_mode, v_cash, v_upi, coalesce(p_upi_ref,''), sh.last_hash, v_hash)
  returning id into v_id;

  for ln in select * from jsonb_array_elements(p_lines) loop
    select * into p from public.products where id = (ln->>'product_id')::uuid;
    insert into public.sale_items (sale_id, product_id, qty, price, cost, method)
    values (v_id, p.id, (ln->>'qty')::int, p.mrp, p.cost, coalesce(ln->>'method','scan'));
    insert into public.stock (shop_id, product_id, tenant_id, qty) values (p_shop, p.id, me.tenant_id, -(ln->>'qty')::int)
    on conflict (shop_id, product_id) do update set qty = public.stock.qty - (ln->>'qty')::int;
  end loop;

  update public.shops set seq = seq + 1, last_hash = v_hash where id = p_shop;
  if has_ovr then perform public._audit(me.tenant_id, 'Bill with manual override', v_no); end if;

  return jsonb_build_object('id', v_id, 'bill_no', v_no, 'ts', v_ts, 'total', total, 'cost', cst, 'mode', p_mode,
    'cash', v_cash, 'upi', v_upi, 'prev_hash', sh.last_hash, 'hash', v_hash);
end $$;

-- ---------- void a sale (keeps the record, restores stock) ----------
create or replace function public.void_sale(p_sale uuid, p_reason text, p_approver uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; s public.sales; a public.members;
begin
  me := public._require_member();
  select * into s from public.sales where id = p_sale and tenant_id = me.tenant_id for update;
  if s.id is null then raise exception 'Bill not found'; end if;
  if s.status = 'void' then raise exception 'Bill already void'; end if;
  if not public.can_manage_shop(s.shop_id) then raise exception 'Only a manager or owner can void'; end if;
  a := public._approve(me.tenant_id, s.shop_id, p_approver, p_pin);
  update public.sales set status = 'void', void_by = a.id, void_reason = p_reason, void_ts = now() where id = s.id;
  update public.stock st set qty = st.qty + i.qty from public.sale_items i
    where i.sale_id = s.id and st.shop_id = s.shop_id and st.product_id = i.product_id;
  perform public._audit(me.tenant_id, 'Bill voided', s.bill_no || ' · ₹' || s.total || ' · ' || p_reason || ' · approved by ' || a.name);
end $$;

-- ---------- ledger integrity check ----------
create or replace function public.verify_ledger(p_shop uuid)
returns table (bills int, broken int) language plpgsql stable security definer set search_path = public, extensions as $$
declare r record; prev text := '0000000000000000'; n int := 0; b int := 0; items text; h text;
begin
  if not public.can_see_shop(p_shop) then raise exception 'Not allowed'; end if;
  for r in select * from public.sales where shop_id = p_shop order by ts, bill_no loop
    select string_agg(product_id::text || 'x' || qty || '@' || price, ',' order by id) || ',' into items
      from public.sale_items where sale_id = r.id;
    h := left(encode(extensions.digest(r.prev_hash || '|' || r.bill_no || '|' || (extract(epoch from r.ts)*1000)::bigint
         || '|' || r.total || '|' || r.mode || '|' || coalesce(items,''), 'sha256'), 'hex'), 16);
    if r.prev_hash <> prev or h <> r.hash then b := b + 1; end if;
    prev := r.hash; n := n + 1;
  end loop;
  return query select n, b;
end $$;

-- ---------- stock: receive, transfer, count ----------
create or replace function public.receive_stock(p_shop uuid, p_ref text, p_party text, p_lines jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare me public.members; ln jsonb; n int := 0; q int; pid uuid;
begin
  me := public._require_member();
  if not public.can_manage_shop(p_shop) then raise exception 'Not allowed for this shop'; end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := (ln->>'qty')::int; pid := (ln->>'product_id')::uuid;
    if q is null or q <= 0 then continue; end if;
    if not exists (select 1 from public.products where id = pid and (tenant_id is null or tenant_id = me.tenant_id)) then
      raise exception 'Unknown product'; end if;
    insert into public.stock (shop_id, product_id, tenant_id, qty) values (p_shop, pid, me.tenant_id, q)
      on conflict (shop_id, product_id) do update set qty = public.stock.qty + q;
    insert into public.stock_moves (tenant_id, shop_id, product_id, qty, type, ref, party, member_id)
      values (me.tenant_id, p_shop, pid, q, 'inward', coalesce(p_ref,''), coalesce(p_party,''), me.id);
    n := n + q;
  end loop;
  perform public._audit(me.tenant_id, 'Stock received', coalesce(p_ref,'') || ' · ' || n || ' units');
  return n;
end $$;

create or replace function public.transfer_stock(p_from uuid, p_to uuid, p_lines jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare me public.members; ln jsonb; q int; pid uuid; have int; ref text := 'TRF-' || to_char(now(),'YYMMDDHH24MISS');
begin
  me := public._require_member();
  if me.role <> 'owner' then raise exception 'Only the owner can transfer between shops'; end if;
  if p_from = p_to then raise exception 'Pick two different shops'; end if;
  if (select count(*) from public.shops where id in (p_from,p_to) and tenant_id = me.tenant_id) <> 2 then raise exception 'Shop not found'; end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := (ln->>'qty')::int; pid := (ln->>'product_id')::uuid;
    select qty into have from public.stock where shop_id = p_from and product_id = pid for update;
    if coalesce(have,0) < q then raise exception 'Not enough stock at the sending shop'; end if;
    update public.stock set qty = qty - q where shop_id = p_from and product_id = pid;
    insert into public.stock (shop_id, product_id, tenant_id, qty) values (p_to, pid, me.tenant_id, q)
      on conflict (shop_id, product_id) do update set qty = public.stock.qty + q;
    insert into public.stock_moves (tenant_id, shop_id, product_id, qty, type, ref, member_id) values
      (me.tenant_id, p_from, pid, -q, 'transfer', ref, me.id), (me.tenant_id, p_to, pid, q, 'transfer', ref, me.id);
  end loop;
  perform public._audit(me.tenant_id, 'Stock transfer', ref);
  return ref;
end $$;

-- p_counts: [{"product_id":uuid,"counted":int}]
create or replace function public.adjust_stock(p_shop uuid, p_counts jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare me public.members; ln jsonb; pid uuid; c int; cur int; n int := 0;
begin
  me := public._require_member();
  if not public.can_manage_shop(p_shop) then raise exception 'Not allowed for this shop'; end if;
  for ln in select * from jsonb_array_elements(p_counts) loop
    pid := (ln->>'product_id')::uuid; c := greatest(0,(ln->>'counted')::int);
    select qty into cur from public.stock where shop_id = p_shop and product_id = pid for update;
    cur := coalesce(cur,0);
    if c <> cur then
      insert into public.stock (shop_id, product_id, tenant_id, qty) values (p_shop, pid, me.tenant_id, c)
        on conflict (shop_id, product_id) do update set qty = c;
      insert into public.stock_moves (tenant_id, shop_id, product_id, qty, type, ref, member_id)
        values (me.tenant_id, p_shop, pid, c - cur, 'adjust', 'Physical count', me.id);
      n := n + 1;
    end if;
  end loop;
  perform public._audit(me.tenant_id, 'Stock count posted', n || ' variances');
  return n;
end $$;

-- ---------- salary ----------
create or replace function public.pay_salary(p_member uuid, p_month text, p_net numeric, p_approver uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; t public.members; a public.members;
begin
  me := public._require_member();
  select * into t from public.members where id = p_member and tenant_id = me.tenant_id;
  if t.id is null or not public.can_manage_member(p_member) then raise exception 'Not allowed'; end if;
  a := public._approve(me.tenant_id, t.shop_id, p_approver, p_pin);
  insert into public.payroll (tenant_id, member_id, month, net, approved_by) values (me.tenant_id, p_member, p_month, p_net, a.id);
  insert into public.expenses (tenant_id, shop_id, category, amount, note, mode, member_id)
    values (me.tenant_id, t.shop_id, 'Salary', p_net, t.name || ' · ' || p_month, 'Bank', a.id);
  perform public._audit(me.tenant_id, 'Salary paid', t.name || ' ₹' || p_net);
end $$;

-- ---------- free-form audit entry from the app ----------
create or replace function public.log_audit(p_action text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public._require_member();
  perform public._audit(me.tenant_id, left(p_action,80), left(p_detail,300));
end $$;

-- ---------- add a shop (owner) with zero stock rows ----------
create or replace function public.add_shop(p_name text, p_address text, p_license text, p_upi text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me public.members; s uuid; n int; code text;
begin
  me := public._require_member();
  if me.role <> 'owner' then raise exception 'Only the owner can add shops'; end if;
  select count(*) + 1 into n from public.shops where tenant_id = me.tenant_id;
  code := upper(left(regexp_replace(coalesce(p_name,'SHOP'), '[^A-Za-z]', '', 'g') || 'XX', 2)) || n;
  insert into public.shops (tenant_id, name, code, address, license, upi)
  values (me.tenant_id, p_name, code, coalesce(p_address,''), coalesce(p_license,''), coalesce(p_upi,'')) returning id into s;
  insert into public.stock (shop_id, product_id, tenant_id, qty)
    select s, p.id, me.tenant_id, 0 from public.products p where p.tenant_id is null or p.tenant_id = me.tenant_id;
  perform public._audit(me.tenant_id, 'Shop added', p_name);
  return s;
end $$;

-- ---------- platform admin overview ----------
create or replace function public.admin_overview(p_since timestamptz)
returns table (id uuid, slug text, name text, type text, plan text, city text, color text, logo text, status text,
               shops int, users int, sales_today numeric, bills_today int, sales_7d numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  return query
  select t.id, t.slug, t.name, t.type, t.plan, t.city, t.color, t.logo, t.status,
    (select count(*)::int from public.shops s where s.tenant_id = t.id),
    (select count(*)::int from public.members m where m.tenant_id = t.id),
    coalesce((select sum(total) from public.sales x where x.tenant_id = t.id and x.status = 'locked' and x.ts >= p_since),0),
    (select count(*)::int from public.sales x where x.tenant_id = t.id and x.status = 'locked' and x.ts >= p_since),
    coalesce((select sum(total) from public.sales x where x.tenant_id = t.id and x.status = 'locked' and x.ts >= p_since - interval '6 days'),0)
  from public.tenants t order by t.created_at;
end $$;

-- owners can rebrand, but only platform admins change plan, status or workspace code
create or replace function public._guard_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    new.plan := old.plan; new.status := old.status; new.slug := old.slug; new.id := old.id;
  end if;
  return new;
end $$;
drop trigger if exists tenants_guard on public.tenants;
create trigger tenants_guard before update on public.tenants for each row execute function public._guard_tenant();

-- functions are for signed-in users only (except workspace_public)
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.workspace_public(text) to anon;

-- realtime: stream new and voided bills to dashboards
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.sales; exception when duplicate_object then null; end;
  end if;
end $$;

-- >>> 20261123000004_master_catalog.sql
-- MuneemX master catalog (shared by every client; tenant_id = null).
-- SAMPLE MRPs — MRPs differ by state; edit before going live.
insert into public.products (tenant_id, brand, name, category, pack, size_ml, mrp, cost, barcode, popularity, source) values
(null, 'Officer''s Choice', 'Blue Whisky', 'Whisky', 'Full', 750, 600, 504, '8901000079190', 0.84, 'master'),
(null, 'Officer''s Choice', 'Blue Whisky', 'Whisky', 'Half', 375, 310, 260, '8901000158383', 1.68, 'master'),
(null, 'Officer''s Choice', 'Blue Whisky', 'Whisky', 'Quarter', 180, 160, 134, '8901000237576', 4.2, 'master'),
(null, 'McDowell''s No.1', 'Reserve Whisky', 'Whisky', 'Full', 750, 760, 638, '8901000316769', 0.9, 'master'),
(null, 'McDowell''s No.1', 'Reserve Whisky', 'Whisky', 'Half', 375, 390, 328, '8901000395955', 1.8, 'master'),
(null, 'McDowell''s No.1', 'Reserve Whisky', 'Whisky', 'Quarter', 180, 200, 168, '8901000475145', 4.5, 'master'),
(null, 'Royal Stag', 'Deluxe Whisky', 'Whisky', 'Full', 750, 880, 739, '8901000554338', 0.96, 'master'),
(null, 'Royal Stag', 'Deluxe Whisky', 'Whisky', 'Half', 375, 450, 378, '8901000633521', 1.92, 'master'),
(null, 'Royal Stag', 'Deluxe Whisky', 'Whisky', 'Quarter', 180, 230, 193, '8901000712714', 4.8, 'master'),
(null, 'Imperial Blue', 'Superior Grain Whisky', 'Whisky', 'Full', 750, 840, 706, '8901000791900', 0.84, 'master'),
(null, 'Imperial Blue', 'Superior Grain Whisky', 'Whisky', 'Half', 375, 430, 361, '8901000871091', 1.68, 'master'),
(null, 'Imperial Blue', 'Superior Grain Whisky', 'Whisky', 'Quarter', 180, 220, 185, '8901000950284', 4.2, 'master'),
(null, '8PM', 'Premium Black Whisky', 'Whisky', 'Full', 750, 820, 689, '8901001029477', 0.6, 'master'),
(null, '8PM', 'Premium Black Whisky', 'Whisky', 'Half', 375, 420, 353, '8901001108660', 1.2, 'master'),
(null, '8PM', 'Premium Black Whisky', 'Whisky', 'Quarter', 180, 210, 176, '8901001187856', 3, 'master'),
(null, 'Blenders Pride', 'Rare Premium Whisky', 'Whisky', 'Full', 750, 1350, 1134, '8901001267046', 0.6, 'master'),
(null, 'Blenders Pride', 'Rare Premium Whisky', 'Whisky', 'Half', 375, 690, 580, '8901001346239', 1.2, 'master'),
(null, 'Blenders Pride', 'Rare Premium Whisky', 'Whisky', 'Quarter', 180, 350, 294, '8901001425422', 3, 'master'),
(null, 'Antiquity', 'Blue Ultra Premium Whisky', 'Whisky', 'Full', 750, 1450, 1218, '8901001504615', 0.3, 'master'),
(null, 'Antiquity', 'Blue Ultra Premium Whisky', 'Whisky', 'Half', 375, 730, 613, '8901001583801', 0.6, 'master'),
(null, 'Antiquity', 'Blue Ultra Premium Whisky', 'Whisky', 'Quarter', 180, 370, 311, '8901001662995', 1.5, 'master'),
(null, 'Signature', 'Rare Aged Whisky', 'Whisky', 'Full', 750, 1500, 1260, '8901001742185', 0.36, 'master'),
(null, 'Signature', 'Rare Aged Whisky', 'Whisky', 'Half', 375, 760, 638, '8901001821378', 0.72, 'master'),
(null, 'Signature', 'Rare Aged Whisky', 'Whisky', 'Quarter', 180, 390, 328, '8901001900561', 1.8, 'master'),
(null, 'Teacher''s', 'Highland Cream Scotch', 'Scotch', 'Full', 750, 2400, 2016, '8901001979758', 0.24, 'master'),
(null, 'Teacher''s', 'Highland Cream Scotch', 'Scotch', 'Half', 375, 1210, 1016, '8901002058940', 0.48, 'master'),
(null, 'Teacher''s', 'Highland Cream Scotch', 'Scotch', 'Quarter', 180, 610, 512, '8901002138130', 1.2, 'master'),
(null, '100 Pipers', 'Deluxe Blended Scotch', 'Scotch', 'Full', 750, 1900, 1596, '8901002217323', 0.24, 'master'),
(null, '100 Pipers', 'Deluxe Blended Scotch', 'Scotch', 'Half', 375, 960, 806, '8901002296519', 0.48, 'master'),
(null, '100 Pipers', 'Deluxe Blended Scotch', 'Scotch', 'Quarter', 180, 490, 412, '8901002375702', 1.2, 'master'),
(null, 'Black Dog', 'Triple Gold Reserve', 'Scotch', 'Full', 750, 2900, 2436, '8901002454896', 0.15, 'master'),
(null, 'Black Dog', 'Triple Gold Reserve', 'Scotch', 'Half', 375, 1460, 1226, '8901002534086', 0.3, 'master'),
(null, 'Black Dog', 'Triple Gold Reserve', 'Scotch', 'Quarter', 180, 730, 613, '8901002613279', 0.75, 'master'),
(null, 'Old Monk', 'XXX Vatted Rum', 'Rum', 'Full', 750, 620, 521, '8901002692465', 0.72, 'master'),
(null, 'Old Monk', 'XXX Vatted Rum', 'Rum', 'Half', 375, 320, 269, '8901002771658', 1.44, 'master'),
(null, 'Old Monk', 'XXX Vatted Rum', 'Rum', 'Quarter', 180, 170, 143, '8901002850841', 3.6, 'master'),
(null, 'McDowell''s', 'Celebration Rum', 'Rum', 'Full', 750, 600, 504, '8901002930031', 0.48, 'master'),
(null, 'McDowell''s', 'Celebration Rum', 'Rum', 'Half', 375, 310, 260, '8901003009224', 0.96, 'master'),
(null, 'McDowell''s', 'Celebration Rum', 'Rum', 'Quarter', 180, 160, 134, '8901003088410', 2.4, 'master'),
(null, 'Bacardi', 'Carta Blanca White Rum', 'Rum', 'Full', 750, 1250, 1050, '8901003167603', 0.3, 'master'),
(null, 'Bacardi', 'Carta Blanca White Rum', 'Rum', 'Half', 375, 630, 529, '8901003246797', 0.6, 'master'),
(null, 'Bacardi', 'Carta Blanca White Rum', 'Rum', 'Quarter', 180, 320, 269, '8901003325980', 1.5, 'master'),
(null, 'Magic Moments', 'Grain Vodka', 'Vodka', 'Full', 750, 900, 756, '8901003405170', 0.48, 'master'),
(null, 'Magic Moments', 'Grain Vodka', 'Vodka', 'Half', 375, 460, 386, '8901003484366', 0.96, 'master'),
(null, 'Magic Moments', 'Grain Vodka', 'Vodka', 'Quarter', 180, 230, 193, '8901003563559', 2.4, 'master'),
(null, 'Smirnoff', 'Triple Distilled Vodka', 'Vodka', 'Full', 750, 1150, 966, '8901003642742', 0.3, 'master'),
(null, 'Smirnoff', 'Triple Distilled Vodka', 'Vodka', 'Half', 375, 590, 496, '8901003721935', 0.6, 'master'),
(null, 'Smirnoff', 'Triple Distilled Vodka', 'Vodka', 'Quarter', 180, 300, 252, '8901003801125', 1.5, 'master'),
(null, 'Mansion House', 'French Brandy', 'Brandy', 'Full', 750, 700, 588, '8901003880311', 0.42, 'master'),
(null, 'Mansion House', 'French Brandy', 'Brandy', 'Half', 375, 360, 302, '8901003959505', 0.84, 'master'),
(null, 'Mansion House', 'French Brandy', 'Brandy', 'Quarter', 180, 190, 160, '8901004038698', 2.1, 'master'),
(null, 'Honey Bee', 'Brandy', 'Brandy', 'Full', 750, 640, 538, '8901004117881', 0.36, 'master'),
(null, 'Honey Bee', 'Brandy', 'Brandy', 'Half', 375, 330, 277, '8901004197074', 0.72, 'master'),
(null, 'Honey Bee', 'Brandy', 'Brandy', 'Quarter', 180, 170, 143, '8901004276267', 1.8, 'master'),
(null, 'Blue Riband', 'London Dry Gin', 'Gin', 'Full', 750, 900, 756, '8901004355450', 0.15, 'master'),
(null, 'Blue Riband', 'London Dry Gin', 'Gin', 'Half', 375, 460, 386, '8901004434643', 0.3, 'master'),
(null, 'Blue Riband', 'London Dry Gin', 'Gin', 'Quarter', 180, 230, 193, '8901004513836', 0.75, 'master'),
(null, 'Kingfisher', 'Premium Lager', 'Beer', 'Pint', 650, 180, 155, '8901004593029', 4.8, 'master'),
(null, 'Kingfisher', 'Premium Lager', 'Beer', 'Can', 500, 150, 129, '8901004672212', 2.4, 'master'),
(null, 'Kingfisher', 'Ultra Lager', 'Beer', 'Pint', 650, 230, 198, '8901004751405', 1.6, 'master'),
(null, 'Tuborg', 'Strong', 'Beer', 'Pint', 650, 190, 163, '8901004830599', 2.56, 'master'),
(null, 'Budweiser', 'Premium Lager', 'Beer', 'Pint', 650, 240, 206, '8901004909783', 1.92, 'master'),
(null, 'Budweiser', 'Magnum Strong', 'Beer', 'Can', 500, 190, 163, '8901004988979', 1.28, 'master'),
(null, 'Bira 91', 'White Wheat', 'Beer', 'Pint', 650, 220, 189, '8901005068168', 1.12, 'master'),
(null, 'Haywards 5000', 'Super Strong', 'Beer', 'Pint', 650, 170, 146, '8901005147351', 2.24, 'master'),
(null, 'Carlsberg', 'Elephant Strong', 'Beer', 'Pint', 650, 230, 198, '8901005226544', 1.28, 'master'),
(null, 'Sula', 'Shiraz Cabernet', 'Wine', 'Full', 750, 950, 817, '8901005305737', 0.24, 'master'),
(null, 'Bacardi Breezer', 'Cranberry', 'RTD', 'Bottle', 275, 120, 103, '8901005384923', 0.8, 'master')
on conflict do nothing;

-- >>> 20261123000005_pin_hardening.sql
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
