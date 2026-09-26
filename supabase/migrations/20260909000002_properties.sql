-- BrightStay · migration 002 — properties, units, leases
-- Requires migration 001 (profiles, auth helpers).

-- ---- Properties ----
create table public.properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  description text,
  caretaker_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Units (houses / rooms) ----
create type public.unit_type as enum ('Bedsitter', 'Studio', '1-Bedroom', '2-Bedroom', '3-Bedroom', '4-Bedroom');
create type public.unit_status as enum ('vacant', 'occupied', 'maintenance');

create table public.units (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  house_number text not null,
  unit_type public.unit_type not null default 'Bedsitter',
  monthly_rent numeric(12,2) not null default 0 check (monthly_rent >= 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  status public.unit_status not null default 'vacant',
  size_m2 numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, house_number)
);

-- ---- Leases (the tenancy record) ----
create type public.lease_status as enum ('active', 'ended', 'pending');

create table public.leases (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date,
  monthly_rent numeric(12,2) not null,
  deposit_paid numeric(12,2) not null default 0,
  status public.lease_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_units_property on public.units(property_id);
create index if not exists idx_leases_tenant on public.leases(tenant_id);
create index if not exists idx_leases_unit on public.leases(unit_id);

-- Keep units.status in sync when a lease starts/ends (best-effort helper)
create or replace function public.sync_unit_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.units
  set status = case when new.status = 'active' then 'occupied'::public.unit_status else 'vacant'::public.unit_status end
  where id = new.unit_id;
  return new;
end;
$$;

drop trigger if exists leases_sync_unit on public.leases;
create trigger leases_sync_unit
  after insert or update of status on public.leases
  for each row execute function public.sync_unit_status();

-- ---- RLS: properties ----
alter table public.properties enable row level security;

drop policy if exists "properties_select_landlord" on public.properties;
create policy "properties_select_landlord" on public.properties
  for select using (public.is_landlord());

drop policy if exists "properties_select_caretaker_own" on public.properties;
create policy "properties_select_caretaker_own" on public.properties
  for select using (caretaker_id = auth.uid());

drop policy if exists "properties_insert_landlord" on public.properties;
create policy "properties_insert_landlord" on public.properties
  for insert with check (public.is_landlord());

drop policy if exists "properties_update_landlord" on public.properties;
create policy "properties_update_landlord" on public.properties
  for update using (public.is_landlord()) with check (public.is_landlord());

drop policy if exists "properties_delete_landlord" on public.properties;
create policy "properties_delete_landlord" on public.properties
  for delete using (public.is_landlord());

-- ---- RLS: units ----
alter table public.units enable row level security;

drop policy if exists "units_select_landlord" on public.units;
create policy "units_select_landlord" on public.units
  for select using (public.is_landlord());

drop policy if exists "units_select_caretaker_own" on public.units;
create policy "units_select_caretaker_own" on public.units
  for select using (public.is_property_caretaker(property_id));

drop policy if exists "units_select_tenant_own" on public.units;
create policy "units_select_tenant_own" on public.units
  for select using (
    exists (
      select 1 from public.leases l
      where l.unit_id = units.id and l.tenant_id = auth.uid() and l.status = 'active'
    )
  );

drop policy if exists "units_insert_staff" on public.units;
create policy "units_insert_staff" on public.units
  for insert with check (public.is_staff());

drop policy if exists "units_update_staff" on public.units;
create policy "units_update_staff" on public.units
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "units_delete_landlord" on public.units;
create policy "units_delete_landlord" on public.units
  for delete using (public.is_landlord());

-- ---- RLS: leases ----
alter table public.leases enable row level security;

drop policy if exists "leases_select_landlord" on public.leases;
create policy "leases_select_landlord" on public.leases
  for select using (public.is_landlord());

drop policy if exists "leases_select_caretaker_own" on public.leases;
create policy "leases_select_caretaker_own" on public.leases
  for select using (
    exists (
      select 1 from public.units u
      where u.id = leases.unit_id and public.is_property_caretaker(u.property_id)
    )
  );

drop policy if exists "leases_select_tenant_own" on public.leases;
create policy "leases_select_tenant_own" on public.leases
  for select using (tenant_id = auth.uid());

drop policy if exists "leases_insert_staff" on public.leases;
create policy "leases_insert_staff" on public.leases
  for insert with check (public.is_staff());

drop policy if exists "leases_update_staff" on public.leases;
create policy "leases_update_staff" on public.leases
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "leases_delete_landlord" on public.leases;
create policy "leases_delete_landlord" on public.leases
  for delete using (public.is_landlord());

grant select, insert, update, delete on public.properties, public.units, public.leases to authenticated;