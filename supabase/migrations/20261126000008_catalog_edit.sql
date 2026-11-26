-- =====================================================================
-- MuneemX — edit catalog + product photos
-- * Own products (added by a workspace): fully editable by owner / manager.
-- * Master products: a workspace can set its own MRP, cost and photo
--   (product_overrides) without changing the shared master list.
-- * Bills use the workspace's MRP / cost.
-- =====================================================================
alter table public.products add column if not exists image_url text;

create table if not exists public.product_overrides (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  mrp         numeric(10,2) check (mrp >= 0),
  cost        numeric(10,2) check (cost >= 0),
  image_url   text,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, product_id)
);
alter table public.product_overrides enable row level security;
create policy overrides_read on public.product_overrides for select
  using (tenant_id = public.my_tenant() or public.is_platform_admin());

create or replace function public.set_product_override(p_product uuid, p_mrp numeric, p_cost numeric, p_image text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; p public.products;
begin
  me := public._require_member();
  if me.role not in ('owner','manager') then raise exception 'Only an owner or manager can edit the catalog'; end if;
  select * into p from public.products where id = p_product and tenant_id is null;
  if p.id is null then raise exception 'Not a master product'; end if;
  if p_mrp is not null and p_mrp < 0 or p_cost is not null and p_cost < 0 then raise exception 'Price cannot be negative'; end if;
  insert into public.product_overrides (tenant_id, product_id, mrp, cost, image_url)
  values (me.tenant_id, p.id, p_mrp, p_cost, nullif(p_image,''))
  on conflict (tenant_id, product_id) do update set mrp = excluded.mrp, cost = excluded.cost, image_url = excluded.image_url, updated_at = now();
  perform public._audit(me.tenant_id, 'Product edited', p.brand || ' ' || p.name || ' ' || p.pack || ' · MRP ₹' || coalesce(p_mrp, p.mrp));
end $$;

create or replace function public.lock_sale(
  p_shop uuid, p_lines jsonb, p_mode text, p_cash numeric default 0,
  p_upi_ref text default '', p_approver uuid default null, p_pin text default null,
  p_discount numeric default 0, p_cust_name text default '', p_cust_phone text default '')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.members; sh public.shops; pol jsonb; ln jsonb; p public.products;
  q int; meth text; have int; gross numeric := 0; cst numeric := 0; has_ovr boolean := false;
  disc numeric := round(coalesce(p_discount,0), 2); net numeric; v_cash numeric := 0; v_upi numeric := 0; v_credit numeric := 0;
  om numeric; oc numeric; v_no text; v_ts timestamptz := now(); v_hash text; v_id uuid; items text := ''; cid uuid; ph text;
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
    select o.mrp, o.cost into om, oc from public.product_overrides o where o.tenant_id = me.tenant_id and o.product_id = p.id;
    if om is not null then p.mrp := om; end if; if oc is not null then p.cost := oc; end if;
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
    select o.mrp, o.cost into om, oc from public.product_overrides o where o.tenant_id = me.tenant_id and o.product_id = p.id;
    if om is not null then p.mrp := om; end if; if oc is not null then p.cost := oc; end if;
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


revoke execute on function public.set_product_override(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.set_product_override(uuid, numeric, numeric, text) to authenticated;
