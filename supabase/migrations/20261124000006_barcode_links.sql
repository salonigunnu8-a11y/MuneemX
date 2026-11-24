-- =====================================================================
-- MuneemX — linked barcodes
-- Real bottles carry the manufacturer's barcode. A workspace can link any
-- scanned barcode to a catalog product once; after that it bills normally.
-- Owners and managers link directly; a salesman needs a manager approval token.
-- =====================================================================
create table if not exists public.product_barcodes (
  id          bigserial primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  barcode     text not null check (length(barcode) between 3 and 64),
  member_id   uuid references public.members(id),
  created_at  timestamptz not null default now(),
  unique (tenant_id, barcode)
);
alter table public.product_barcodes enable row level security;
create policy barcodes_read on public.product_barcodes for select
  using (tenant_id = public.my_tenant() or public.is_platform_admin());

create or replace function public.link_barcode(p_product uuid, p_barcode text, p_approver uuid default null, p_pin text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members; code text := btrim(p_barcode); p public.products;
begin
  me := public._require_member();
  if me.role = 'salesman' then perform public._approve(me.tenant_id, me.shop_id, p_approver, p_pin); end if;
  select * into p from public.products where id = p_product and (tenant_id is null or tenant_id = me.tenant_id);
  if p.id is null then raise exception 'Product not found'; end if;
  if exists (select 1 from public.products where barcode = code and (tenant_id is null or tenant_id = me.tenant_id) and id <> p_product) then
    raise exception 'This barcode already belongs to another product';
  end if;
  insert into public.product_barcodes (tenant_id, product_id, barcode, member_id) values (me.tenant_id, p_product, code, me.id)
  on conflict (tenant_id, barcode) do update set product_id = excluded.product_id, member_id = excluded.member_id, created_at = now();
  perform public._audit(me.tenant_id, 'Barcode linked', code || ' → ' || p.brand || ' ' || p.name || ' ' || p.pack);
end $$;

create or replace function public.unlink_barcode(p_barcode text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public._require_member();
  if me.role not in ('owner','manager') then raise exception 'Only an owner or manager can remove a barcode link'; end if;
  delete from public.product_barcodes where tenant_id = me.tenant_id and barcode = btrim(p_barcode);
  perform public._audit(me.tenant_id, 'Barcode unlinked', p_barcode);
end $$;

revoke execute on function public.link_barcode(uuid, text, uuid, text) from public, anon;
revoke execute on function public.unlink_barcode(text) from public, anon;
grant execute on function public.link_barcode(uuid, text, uuid, text) to authenticated;
grant execute on function public.unlink_barcode(text) to authenticated;
