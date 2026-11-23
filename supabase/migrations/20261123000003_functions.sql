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
