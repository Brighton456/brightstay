-- bring public.profiles in line with fetchProfile:
-- add nullable role, full_name, phone, email and sync them from auth.users on insert

alter table public.profiles
    add column if not exists role text,
    add column if not exists full_name text,
    add column if not exists phone text,
    add column if not exists email text;

-- sync profile metadata from auth.users when a profile row is created
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_full_name text;
    v_role text;
    v_phone text;
    v_email text;
begin
    select (raw_user_meta_data ->> 'full_name'),
           (raw_user_meta_data ->> 'role'),
           (raw_user_meta_data ->> 'phone'),
           email
    into v_full_name, v_role, v_phone, v_email
    from auth.users
    where id = new.id;

    if not found then
        return new;
    end if;

    new.full_name := coalesce(new.full_name, v_full_name);
    new.role := coalesce(new.role, v_role::public.user_role);
    new.phone := coalesce(new.phone, v_phone);
    new.email := coalesce(new.email, v_email);

    return new;
end;
$$;

drop trigger if exists on_profile_auth_sync on public.profiles;
create trigger on_profile_auth_sync
    before insert on public.profiles
    for each row
    execute function public.sync_profile_from_auth();

-- backfill existing profile rows from auth.users
update public.profiles p
set full_name = coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name'),
    role = coalesce(p.role, u.raw_user_meta_data ->> 'role'),
    phone = coalesce(p.phone, u.raw_user_meta_data ->> 'phone'),
    email = coalesce(p.email, u.email)
from auth.users u
where u.id = p.id;