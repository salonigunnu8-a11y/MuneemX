-- =====================================================================
-- MuneemX — cartons, main store, branch transfers
-- * A linked barcode can stand for a carton of N bottles (units).
-- * One shop can be marked as the main store / godown.
-- * Transfers: owner, or the manager of the sending shop. Each side of a
--   transfer records the other shop's name so registers read clearly.
-- =====================================================================
alter table public.product_barcodes add column if not exists units integer not null default 1 check (units between 1 and 500);
alter table public.shops add column if not exists is_main boolean not null default false;

drop function if exists public.link_barcode(uuid, text, uuid, text);
create or replace function public.link_barcode(p_product uuid, p_barcode text, p_approver uuid default null, p_pin text default null, p_units integer default 1)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; code text := btrim(p_barcode); p public.products; u int := greatest(1, least(coalesce(p_units,1), 500));
begin
  me := public._require_member();
  if me.role = 'salesman' then perform public._approve(me.tenant_id, me.shop_id, p_approver, p_pin); end if;
  select * into p from public.products where id = p_product and (tenant_id is null or tenant_id = me.tenant_id);
  if p.id is null then raise exception 'Product not found'; end if;
  if exists (select 1 from public.products where barcode = code and (tenant_id is null or tenant_id = me.tenant_id) and id <> p_product) then
    raise exception 'This barcode already belongs to another product';
  end if;
  insert into public.product_barcodes (tenant_id, product_id, barcode, member_id, units) values (me.tenant_id, p_product, code, me.id, u)
  on conflict (tenant_id, barcode) do update set product_id = excluded.product_id, member_id = excluded.member_id, units = excluded.units, created_at = now();
  perform public._audit(me.tenant_id, 'Barcode linked', code || ' → ' || p.brand || ' ' || p.name || ' ' || p.pack || case when u > 1 then ' (carton of ' || u || ')' else '' end);
end $$;

create or replace function public.set_main_shop(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public._require_member();
  if me.role <> 'owner' then raise exception 'Only the owner can choose the main store'; end if;
  if p_shop is not null and not exists (select 1 from public.shops where id = p_shop and tenant_id = me.tenant_id) then raise exception 'Shop not found'; end if;
  update public.shops set is_main = (id = p_shop) where tenant_id = me.tenant_id;
  perform public._audit(me.tenant_id, 'Main store set', coalesce((select name from public.shops where id = p_shop), 'none'));
end $$;

create or replace function public.transfer_stock(p_from uuid, p_to uuid, p_lines jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare me public.members; ln jsonb; q int; pid uuid; have int; n int := 0; fname text; tname text;
  ref text := 'TRF-' || to_char(now() at time zone 'Asia/Kolkata','YYMMDD-HH24MISS');
begin
  me := public._require_member();
  if not (me.role = 'owner' or (me.role = 'manager' and me.shop_id = p_from)) then
    raise exception 'Only the owner, or the manager of the sending shop, can transfer stock';
  end if;
  if p_from = p_to then raise exception 'Pick two different shops'; end if;
  select name into fname from public.shops where id = p_from and tenant_id = me.tenant_id;
  select name into tname from public.shops where id = p_to and tenant_id = me.tenant_id;
  if fname is null or tname is null then raise exception 'Shop not found'; end if;
  for ln in select * from jsonb_array_elements(p_lines) loop
    q := (ln->>'qty')::int; pid := (ln->>'product_id')::uuid;
    if q is null or q <= 0 then continue; end if;
    select qty into have from public.stock where shop_id = p_from and product_id = pid for update;
    if coalesce(have,0) < q then
      raise exception 'Not enough stock at %: % has only %', fname, (select brand || ' ' || pack from public.products where id = pid), coalesce(have,0);
    end if;
    update public.stock set qty = qty - q where shop_id = p_from and product_id = pid;
    insert into public.stock (shop_id, product_id, tenant_id, qty) values (p_to, pid, me.tenant_id, q)
      on conflict (shop_id, product_id) do update set qty = public.stock.qty + q;
    insert into public.stock_moves (tenant_id, shop_id, product_id, qty, type, ref, party, member_id) values
      (me.tenant_id, p_from, pid, -q, 'transfer', ref, 'To ' || tname, me.id),
      (me.tenant_id, p_to, pid, q, 'transfer', ref, 'From ' || fname, me.id);
    n := n + q;
  end loop;
  if n = 0 then raise exception 'Nothing to transfer'; end if;
  perform public._audit(me.tenant_id, 'Stock transfer', ref || ' · ' || fname || ' → ' || tname || ' · ' || n || ' bottles');
  return ref;
end $$;

revoke execute on function public.link_barcode(uuid, text, uuid, text, integer) from public, anon;
revoke execute on function public.set_main_shop(uuid) from public, anon;
grant execute on function public.link_barcode(uuid, text, uuid, text, integer) to authenticated;
grant execute on function public.set_main_shop(uuid) to authenticated;
