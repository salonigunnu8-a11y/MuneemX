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
