-- BrightStay · migration 009 — app wiring
-- Role-aware user creation, unit additions the app reads, and tenant-facing RLS so the
-- React client (authenticated) can run the onboarding / tenant / portal flows.

-- (1) handle_new_user honors role / full_name / phone passed via raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), null),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'tenant')
  );
  return new;
end;
$$;

-- Existing grants / revokes from 005/006 stay intact (create or replace keeps the function OID).

-- (2) units: booking deposit + utility billing modes the app renders
alter table public.units
  add column if not exists booking_deposit numeric(12,2) not null default 0
    check (booking_deposit >= 0);
alter table public.units
  add column if not exists utilities jsonb not null default '{"water":"self-paid","electricity":"self-paid"}'::jsonb;

-- (3) properties: staff (incl. caretaker) can create their own property during onboarding
drop policy if exists "properties_insert_staff_own" on public.properties;
create policy "properties_insert_staff_own" on public.properties
  for insert with check (public.is_staff() and created_by = auth.uid());

-- (4) properties: tenant can read the property they hold an active lease on
drop policy if exists "properties_select_tenant_own" on public.properties;
create policy "properties_select_tenant_own" on public.properties
  for select using (
    exists (
      select 1 from public.units u
      join public.leases l on l.unit_id = u.id
      where u.property_id = properties.id
        and l.tenant_id = auth.uid()
        and l.status = 'active'
    )
  );

-- (5) profiles: tenant can read the caretaker assigned to their property
drop policy if exists "profiles_select_tenant_caretaker" on public.profiles;
create policy "profiles_select_tenant_caretaker" on public.profiles
  for select using (
    public.profiles.id in (
      select p.caretaker_id from public.properties p
      where p.caretaker_id is not null
        and exists (
          select 1 from public.units u
          join public.leases l on l.unit_id = u.id
          where u.property_id = p.id
            and l.tenant_id = auth.uid()
            and l.status = 'active'
        )
    )
  );

-- (6) payments: tenant can record their own completed M-Pesa rent payment
drop policy if exists "payments_insert_tenant_own" on public.payments;
create policy "payments_insert_tenant_own" on public.payments
  for insert with check (
    tenant_id = auth.uid()
    and recorded_by = auth.uid()
    and exists (
      select 1 from public.leases l
      where l.id = payments.lease_id
        and l.tenant_id = auth.uid()
        and l.status = 'active'
    )
  );