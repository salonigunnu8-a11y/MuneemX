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
