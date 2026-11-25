-- =====================================================================
-- MuneemX — discounts, customers and udhar (credit) bills
-- * Bills can carry a discount (₹ off the MRP total; the app lets staff enter % or ₹).
-- * Optional customer name + mobile on any bill; required for an Udhar (Credit) bill.
-- * Udhar repayments are recorded per customer; dues = credit bills − repayments.
-- =====================================================================

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null default '',
  phone       text not null default '',
  created_at  timestamptz not null default now()
);
create unique index if not exists customers_tenant_phone on public.customers (tenant_id, phone) where phone <> '';
alter table public.customers enable row level security;
create policy customers_read on public.customers for select
  using (tenant_id = public.my_tenant() or public.is_platform_admin());

alter table public.sales add column if not exists gross       numeric(12,2);
alter table public.sales add column if not exists discount    numeric(12,2) not null default 0;
alter table public.sales add column if not exists credit      numeric(12,2) not null default 0;
alter table public.sales add column if not exists customer_id uuid references public.customers(id);
update public.sales set gross = total where gross is null;
alter table public.sales drop constraint if exists sales_mode_check;
alter table public.sales add constraint sales_mode_check check (mode in ('Cash','UPI','Split','Credit'));
create index if not exists sales_customer on public.sales (customer_id) where customer_id is not null;

create table if not exists public.credit_payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  mode        text not null check (mode in ('Cash','UPI')),
  note        text default '',
  member_id   uuid references public.members(id),
  ts          timestamptz not null default now()
);
create index if not exists credit_payments_tenant_ts on public.credit_payments (tenant_id, ts);
alter table public.credit_payments enable row level security;
create policy credit_payments_read on public.credit_payments for select
  using (public.is_platform_admin() or (tenant_id = public.my_tenant() and (public.my_role() = 'owner' or shop_id = public.my_shop())));

-- find or create a customer (internal)
create or replace function public._customer(p_tenant uuid, p_name text, p_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g'); nm text := btrim(coalesce(p_name,'')); cid uuid;
begin
  if length(ph) = 12 and left(ph,2) = '91' then ph := right(ph,10); end if;
  if ph = '' and nm = '' then return null; end if;
  if ph <> '' then
    select id into cid from public.customers where tenant_id = p_tenant and phone = ph;
    if cid is not null then
      if nm <> '' then update public.customers set name = nm where id = cid; end if;
      return cid;
    end if;
  end if;
  insert into public.customers (tenant_id, name, phone) values (p_tenant, nm, ph) returning id into cid;
  return cid;
end $$;

-- lock_sale v2: discount + customer + Credit (udhar)
drop function if exists public.lock_sale(uuid, jsonb, text, numeric, text, uuid, text);
create or replace function public.lock_sale(
  p_shop uuid, p_lines jsonb, p_mode text, p_cash numeric default 0,
  p_upi_ref text default '', p_approver uuid default null, p_pin text default null,
  p_discount numeric default 0, p_cust_name text default '', p_cust_phone text default '')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.members; sh public.shops; pol jsonb; ln jsonb; p public.products;
  q int; meth text; have int; gross numeric := 0; cst numeric := 0; has_ovr boolean := false;
  disc numeric := round(coalesce(p_discount,0), 2); net numeric; v_cash numeric := 0; v_upi numeric := 0; v_credit numeric := 0;
  v_no text; v_ts timestamptz := now(); v_hash text; v_id uuid; items text := ''; cid uuid; ph text;
begin
  me := public._require_member();
  select * into sh from public.shops where id = p_shop and tenant_id = me.tenant_id for update;
  if sh.id is null then raise exception 'Shop not found'; end if;
  if me.role <> 'owner' and me.shop_id is distinct from p_shop then raise exception 'You can only bill at your own shop'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Bill is empty'; end if;
  if p_mode not in ('Cash','UPI','Split','Credit') then raise exception 'Unknown payment mode'; end if;
  select policies into pol from public.tenants where id = me.tenant_id;

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
    gross := gross + p.mrp * q; cst := cst + p.cost * q;
    items := items || p.id::text || 'x' || q || '@' || p.mrp || ',';
  end loop;

  if has_ovr then
    if not coalesce((pol->>'override')::boolean, true) then raise exception 'Manual override is disabled'; end if;
    perform public._approve(me.tenant_id, p_shop, p_approver, p_pin);
  end if;

  if disc < 0 or disc >= gross then raise exception 'Discount must be less than the bill total'; end if;
  net := gross - disc;

  ph := regexp_replace(coalesce(p_cust_phone,''), '\D', '', 'g');
  if p_mode = 'Credit' then
    if btrim(coalesce(p_cust_name,'')) = '' or length(ph) < 10 then raise exception 'Udhar needs the customer name and a 10-digit mobile number'; end if;
    v_credit := net;
  elsif p_mode = 'Cash' then v_cash := net;
  elsif p_mode = 'UPI' then v_upi := net;
  else
    if coalesce(p_cash,0) <= 0 or p_cash >= net then raise exception 'Split: cash part must be between 0 and the total'; end if;
    v_cash := p_cash; v_upi := net - p_cash;
  end if;
  cid := public._customer(me.tenant_id, p_cust_name, p_cust_phone);

  v_no := sh.code || '-' || lpad((sh.seq + 1)::text, 5, '0');
  v_hash := left(encode(extensions.digest(sh.last_hash || '|' || v_no || '|' || (extract(epoch from v_ts)*1000)::bigint
            || '|' || net || '|' || p_mode || '|' || items, 'sha256'), 'hex'), 16);

  insert into public.sales (bill_no, tenant_id, shop_id, member_id, ts, gross, discount, total, cost, mode, cash, upi, credit, customer_id, upi_ref, prev_hash, hash)
  values (v_no, me.tenant_id, p_shop, me.id, v_ts, gross, disc, net, cst, p_mode, v_cash, v_upi, v_credit, cid, coalesce(p_upi_ref,''), sh.last_hash, v_hash)
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
  if disc > 0 then perform public._audit(me.tenant_id, 'Discount given', v_no || ' · ₹' || disc || ' off ₹' || gross); end if;
  if v_credit > 0 then perform public._audit(me.tenant_id, 'Udhar bill', v_no || ' · ₹' || v_credit || ' · ' || btrim(p_cust_name)); end if;

  return jsonb_build_object('id', v_id, 'bill_no', v_no, 'ts', v_ts, 'gross', gross, 'discount', disc, 'total', net, 'cost', cst, 'mode', p_mode,
    'cash', v_cash, 'upi', v_upi, 'credit', v_credit, 'customer_id', cid, 'prev_hash', sh.last_hash, 'hash', v_hash);
end $$;

-- dues per customer (owner / manager)
create or replace function public.credit_summary()
returns table (customer_id uuid, name text, phone text, credit_total numeric, paid_total numeric, due numeric, bills int, last_bill timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me public.members;
begin
  me := public._require_member();
  if me.role not in ('owner','manager') then raise exception 'Only an owner or manager can see udhar'; end if;
  return query
  select c.id, c.name, c.phone,
    coalesce(s.cr,0), coalesce(pm.pd,0), coalesce(s.cr,0) - coalesce(pm.pd,0), coalesce(s.n,0)::int, s.last
  from public.customers c
  left join (select x.customer_id, sum(x.credit) cr, count(*) n, max(x.ts) last from public.sales x
             where x.tenant_id = me.tenant_id and x.status = 'locked' and x.credit > 0 group by x.customer_id) s on s.customer_id = c.id
  left join (select y.customer_id, sum(y.amount) pd from public.credit_payments y where y.tenant_id = me.tenant_id group by y.customer_id) pm on pm.customer_id = c.id
  where c.tenant_id = me.tenant_id and (coalesce(s.cr,0) > 0 or coalesce(pm.pd,0) > 0)
  order by coalesce(s.cr,0) - coalesce(pm.pd,0) desc;
end $$;

-- record an udhar repayment
create or replace function public.receive_credit(p_customer uuid, p_amount numeric, p_mode text, p_shop uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; c public.customers; due numeric;
begin
  me := public._require_member();
  if me.role not in ('owner','manager') then raise exception 'Only an owner or manager can receive udhar'; end if;
  if not public.can_manage_shop(p_shop) then raise exception 'Not allowed for this shop'; end if;
  select * into c from public.customers where id = p_customer and tenant_id = me.tenant_id;
  if c.id is null then raise exception 'Customer not found'; end if;
  if p_mode not in ('Cash','UPI') then raise exception 'Mode must be Cash or UPI'; end if;
  select coalesce((select sum(credit) from public.sales where customer_id = c.id and status = 'locked'),0)
       - coalesce((select sum(amount) from public.credit_payments where customer_id = c.id),0) into due;
  if p_amount is null or p_amount <= 0 or p_amount > due then raise exception 'Amount must be between ₹1 and the due amount (₹%)', due; end if;
  insert into public.credit_payments (tenant_id, shop_id, customer_id, amount, mode, note, member_id)
  values (me.tenant_id, p_shop, c.id, p_amount, p_mode, coalesce(p_note,''), me.id);
  perform public._audit(me.tenant_id, 'Udhar received', c.name || ' · ₹' || p_amount || ' · ' || p_mode);
end $$;

-- no more age checkbox: switch it off for every workspace
update public.tenants set policies = policies || '{"ageCheck": false}'::jsonb;

revoke execute on function public._customer(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.lock_sale(uuid, jsonb, text, numeric, text, uuid, text, numeric, text, text) from public, anon;
revoke execute on function public.credit_summary() from public, anon;
revoke execute on function public.receive_credit(uuid, numeric, text, uuid, text) from public, anon;
grant execute on function public.lock_sale(uuid, jsonb, text, numeric, text, uuid, text, numeric, text, text) to authenticated;
grant execute on function public.credit_summary() to authenticated;
grant execute on function public.receive_credit(uuid, numeric, text, uuid, text) to authenticated;
