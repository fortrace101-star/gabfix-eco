-- Access helpers. All are SECURITY DEFINER so they read the tables directly and
-- cannot recurse through the policies that call them. Pinned search_path.

create or replace function public.my_profile_id()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.profiles
  where auth_user_id = auth.uid() and status = 'active';
$$;

create or replace function public.auth_role()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role::text from public.profiles
  where auth_user_id = auth.uid() and status = 'active';
$$;

create or replace function public.is_desk()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.auth_role() in ('manager', 'admin', 'customer_relations'), false);
$$;

create or replace function public.has_capability(p_capability text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when public.auth_role() = 'admin' then true
    else exists (
      select 1 from public.role_capabilities rc
      where rc.role::text = public.auth_role()
        and rc.capability = p_capability
    )
  end;
$$;

create or replace function public.owns_booking(p_booking uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking and b.customer_id = public.my_profile_id()
  );
$$;

create or replace function public.is_assigned_technician(p_booking uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.job_assignments ja
    where ja.booking_id = p_booking
      and ja.technician_id = public.my_profile_id()
      and ja.status <> 'removed'
  );
$$;

create or replace function public.can_view_booking(p_booking uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.owns_booking(p_booking)
      or public.is_desk()
      or public.is_assigned_technician(p_booking)
      or (
        public.auth_role() = 'sales_operator'
        and exists (
          select 1 from public.bookings b
          where b.id = p_booking and b.created_by = public.my_profile_id()
        )
      );
$$;

-- Reads the booking id from a storage object path like
-- `<booking_id>/before/photo.jpg`. Returns null when the path is not a booking.
create or replace function public.booking_id_from_path(p_path text)
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

revoke all on function public.my_profile_id() from public;
revoke all on function public.auth_role() from public;
revoke all on function public.is_desk() from public;
revoke all on function public.has_capability(text) from public;
revoke all on function public.owns_booking(uuid) from public;
revoke all on function public.is_assigned_technician(uuid) from public;
revoke all on function public.can_view_booking(uuid) from public;
revoke all on function public.booking_id_from_path(text) from public;

grant execute on function public.my_profile_id() to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_desk() to authenticated;
grant execute on function public.has_capability(text) to authenticated;
grant execute on function public.owns_booking(uuid) to authenticated;
grant execute on function public.is_assigned_technician(uuid) to authenticated;
grant execute on function public.can_view_booking(uuid) to authenticated;
grant execute on function public.booking_id_from_path(text) to authenticated;
