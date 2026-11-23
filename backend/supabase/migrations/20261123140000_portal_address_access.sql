-- A technician has to know where the job is. Booking rows are already scoped by
-- can_view_booking, but the address lives on a customer-owned row, so an assigned
-- technician could not read it and the job detail showed no address.
-- This grants read on the address of bookings the technician is assigned to only.
create policy "addresses read for assigned technician" on public.addresses for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.address_id = addresses.id
        and public.is_assigned_technician(b.id)
    )
  );
