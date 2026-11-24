-- Private media for the Phase 2 flows. Path convention:
-- booking-media/<booking_id>/<file>, inspection-media/<inspection_id>/<file>,
-- support-attachments/<conversation_id>/<file>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'booking-media', 'booking-media', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']
  ),
  (
    'inspection-media', 'inspection-media', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']
  ),
  (
    'support-attachments', 'support-attachments', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

create or replace function public.inspection_id_from_path(p_path text)
returns uuid
language plpgsql immutable
set search_path = public, pg_temp
as $$
begin
  if p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
    return split_part(p_path, '/', 1)::uuid;
  end if;
  return null;
end;
$$;

create or replace function public.conversation_id_from_path(p_path text)
returns uuid
language plpgsql immutable
set search_path = public, pg_temp
as $$
begin
  if p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
    return split_part(p_path, '/', 1)::uuid;
  end if;
  return null;
end;
$$;

revoke all on function public.inspection_id_from_path(text) from public;
revoke all on function public.conversation_id_from_path(text) from public;
grant execute on function public.inspection_id_from_path(text) to authenticated;
grant execute on function public.conversation_id_from_path(text) to authenticated;

-- Booking media ---------------------------------------------------------------

create policy "booking media read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-media'
    and public.can_view_booking(public.booking_id_from_path(name))
  );

create policy "booking media upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-media'
    and (
      public.owns_booking(public.booking_id_from_path(name))
      or public.is_assigned_technician(public.booking_id_from_path(name))
      or public.is_desk()
    )
  );

create policy "booking media delete uploader"
  on storage.objects for delete to authenticated
  using (bucket_id = 'booking-media' and owner = auth.uid());

-- Inspection media ------------------------------------------------------------

create policy "inspection media storage read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inspection-media'
    and public.can_view_inspection(public.inspection_id_from_path(name))
  );

create policy "inspection media storage write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspection-media'
    and public.can_view_inspection(public.inspection_id_from_path(name))
  );

create policy "inspection media storage delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspection-media'
    and (owner = auth.uid() or public.auth_role() in ('manager', 'admin'))
  );

-- Support attachments ---------------------------------------------------------

create policy "support attachments read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and public.can_view_conversation(public.conversation_id_from_path(name))
  );

create policy "support attachments upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and public.can_view_conversation(public.conversation_id_from_path(name))
  );

create policy "support attachments delete uploader"
  on storage.objects for delete to authenticated
  using (bucket_id = 'support-attachments' and owner = auth.uid());
