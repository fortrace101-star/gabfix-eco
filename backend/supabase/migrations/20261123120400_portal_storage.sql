-- Storage buckets declared in SQL so they reach production with `db push`
-- (supabase-guidelines.md section 4). Path convention: `<booking_id>/<kind>/<file>`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('technician-photos', 'technician-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('service-icons', 'service-icons', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "job photos read assigned"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-photos'
    and public.can_view_booking(public.booking_id_from_path(name))
  );

create policy "job photos upload assigned"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (
      public.is_assigned_technician(public.booking_id_from_path(name))
      or public.is_desk()
    )
  );

create policy "job photos delete uploader"
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and owner = auth.uid());

create policy "technician photos read"
  on storage.objects for select to authenticated
  using (bucket_id = 'technician-photos');

create policy "technician photos write"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'technician-photos'
    and (split_part(name, '/', 1) = public.my_profile_id()::text or public.has_capability('manage_staff'))
  )
  with check (
    bucket_id = 'technician-photos'
    and (split_part(name, '/', 1) = public.my_profile_id()::text or public.has_capability('manage_staff'))
  );

create policy "service icons read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'service-icons');

create policy "service icons write"
  on storage.objects for all to authenticated
  using (bucket_id = 'service-icons' and public.has_capability('manage_catalogue'))
  with check (bucket_id = 'service-icons' and public.has_capability('manage_catalogue'));
