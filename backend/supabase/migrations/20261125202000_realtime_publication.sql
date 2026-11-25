-- Nothing in the console listened for changes: the desk only saw a new booking,
-- payment, handover or support message after a manual refresh. These tables now
-- stream through Supabase Realtime, so the web console can refresh itself when the
-- client app or the technician app writes.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'bookings',
    'job_assignments',
    'quotes',
    'inspections',
    'inspection_addenda',
    'payments',
    'cash_handovers',
    'cash_disputes',
    'job_costs',
    'support_conversations',
    'support_messages',
    'notifications'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach v_table in array v_tables loop
    -- Full rows so an update carries the values the console renders.
    execute format('alter table public.%I replica identity full', v_table);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
