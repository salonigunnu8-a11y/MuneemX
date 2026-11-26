-- =====================================================================
-- MuneemX — product photo storage (public bucket, one folder per workspace)
-- Owners / managers upload into <tenant_id>/...; everyone can view.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.my_tenant()::text and public.my_role() in ('owner','manager'));
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.my_tenant()::text and public.my_role() in ('owner','manager'));
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.my_tenant()::text and public.my_role() in ('owner','manager'));
