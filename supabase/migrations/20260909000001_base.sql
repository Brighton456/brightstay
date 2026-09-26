-- BrightStay · migration 001 — base: extensions, enums, profiles, auth helpers
-- Applied when the project is created. Safe to run once on an empty project.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create type public.user_role as enum ('landlord', 'caretaker', 'tenant');

-- Profiles extend auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'tenant',
  full_name text,
  phone text,
  email text,
  id_number text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Auth helper functions ----
create or replace function public.is_landlord()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'landlord'
  );
$$;

create or replace function public.is_caretaker()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'caretaker'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('landlord', 'caretaker')
  );
$$;

-- Is the current user the caretaker assigned to this property?
create or replace function public.is_property_caretaker(p_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
  begin
    return exists (
      select 1 from public.properties
      where id = p_id and caretaker_id = auth.uid()
    );
  end;
$$;

-- ---- RLS: profiles ----
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_staff_all" on public.profiles;
create policy "profiles_select_staff_all" on public.profiles
  for select using (public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Landlord can update anyone (custodian of roles) — cannot grant landlord via public update path
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_landlord()) with check (public.is_landlord());

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;