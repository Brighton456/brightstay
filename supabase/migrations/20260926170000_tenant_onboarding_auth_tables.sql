-- ═══════════════════════════════════════════════════════════════════════════
-- BrightStay · migration 00014 — table-based auth + tenant onboarding
--
-- Auth model (user decision):
--   * Supabase email signups are DISABLED, anonymous signups ENABLED.
--   * The Supabase session (anonymous = role `authenticated`) is only an RLS
--     carrier. Real identity lives in tables:
--       - staff_accounts    (landlord/caretaker, username+password, sessions)
--       - tenant_identities (created at allocation; claimed via 6-digit code)
--   * Every privileged action goes through SECURITY DEFINER RPCs. Direct
--     table access for these tables is revoked from anon+authenticated.
--
-- Brightcaret reference (C:/Users/user/Downloads/Brightcaret-04b91a5c):
-- staff credentials hashed in DB, failed-attempt lockout, session tokens,
-- 12h timeout — implemented here as SQL RPCs (no edge function needed).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Staff accounts ──────────────────────────────────────────────────────
create table if not exists public.staff_accounts (
  id uuid primary key default extensions.uuid_generate_v4(),
  property_id uuid references public.properties(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  phone text,
  email text,
  role text not null check (role in ('landlord','caretaker')),
  password_hash text not null,
  is_active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_staff_accounts_property on public.staff_accounts(property_id);

create table if not exists public.staff_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  staff_id uuid not null references public.staff_accounts(id) on delete cascade,
  token uuid not null unique default extensions.uuid_generate_v4(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);
create index if not exists idx_staff_sessions_staff on public.staff_sessions(staff_id);

-- ── 2. Tenant identities (created by staff at allocation) ─────────────────
create table if not exists public.tenant_identities (
  id uuid primary key default extensions.uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  full_name text not null,
  phone text not null,
  provisioned_email text not null unique,
  code_hash text,                  -- bcrypt hash of the 6-digit access code
  code_expires_at timestamptz,
  code_used_at timestamptz,
  onboarding_completed_at timestamptz,
  failed_code_attempts int not null default 0,
  locked_until timestamptz,
  created_by uuid references public.staff_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tenant_identities_property on public.tenant_identities(property_id);
create index if not exists idx_tenant_identities_unit on public.tenant_identities(unit_id);

-- Plaintext 6-digit code registry (uniqueness + fast lookup).
-- No grants to anon/authenticated: only SECURITY DEFINER functions touch it.
create table if not exists public.tenant_access_codes (
  code text primary key check (code ~ '^\d{6}$'),
  tenant_id uuid not null references public.tenant_identities(id) on delete cascade,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- One capability token per tenant (wizard + dashboard)
create table if not exists public.tenant_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  tenant_id uuid not null unique references public.tenant_identities(id) on delete cascade,
  token uuid not null unique default extensions.uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 3. Wizard submissions (traceable step data) ───────────────────────────
create table if not exists public.tenant_onboarding (
  id uuid primary key default extensions.uuid_generate_v4(),
  tenant_id uuid not null references public.tenant_identities(id) on delete cascade,
  step int not null check (step in (1,2,3)),
  data jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (tenant_id, step)
);
create index if not exists idx_tenant_onboarding_tenant on public.tenant_onboarding(tenant_id);

create table if not exists public.tenant_household_members (
  id uuid primary key default extensions.uuid_generate_v4(),
  tenant_id uuid not null references public.tenant_identities(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists idx_household_tenant on public.tenant_household_members(tenant_id);

create table if not exists public.tenant_emergency_contacts (
  id uuid primary key default extensions.uuid_generate_v4(),
  tenant_id uuid not null references public.tenant_identities(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  county text,
  created_at timestamptz not null default now()
);
create index if not exists idx_emergency_tenant on public.tenant_emergency_contacts(tenant_id);

-- ── 4. Payments: traceable category + FK to tenant identities ─────────────
alter table public.payments add column if not exists category text not null default 'rent';
alter table public.payments drop constraint if exists payments_category_check;
alter table public.payments add constraint payments_category_check
  check (category in ('rent','deposit','booking','other'));

alter table public.payments alter column lease_id drop not null;
alter table public.payments add column if not exists recorded_by_staff uuid references public.staff_accounts(id) on delete set null;
alter table public.payments drop constraint if exists payments_recorded_by_fkey;

-- audit_logs: staff actors live in staff_accounts now (actor_id was profiles-only)
alter table public.audit_logs add column if not exists actor_staff_id uuid references public.staff_accounts(id) on delete set null;
alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs alter column actor_id drop not null;

alter table public.payments drop constraint if exists payments_tenant_id_fkey;
alter table public.payments
  add constraint payments_tenant_id_fkey
  foreign key (tenant_id) references public.tenant_identities(id) on delete cascade;

-- ── 5. Lock down direct table access ──────────────────────────────────────
revoke all on public.tenant_identities, public.tenant_sessions,
  public.tenant_onboarding, public.tenant_household_members,
  public.tenant_emergency_contacts, public.staff_accounts, public.staff_sessions
  from anon, authenticated;

revoke all on public.access_codes, public.tenant_allocations from anon, authenticated;
alter table public.tenant_allocations enable row level security;
alter table public.access_codes enable row level security;
drop policy if exists "System can update access code usage" on public.access_codes;

-- ── 6. Bootstrap: default property + first landlord ──────────────────────
-- With email signups disabled there is no other way to create the first
-- landlord. Username: admin  Password: SetMeUp!2026  (must change on login).
insert into public.properties (name)
select 'BrightStay Estate'
where not exists (select 1 from public.properties);

insert into public.staff_accounts (property_id, username, full_name, role, password_hash, must_change_password)
select p.id, 'admin', 'Administrator', 'landlord',
       crypt('SetMeUp!2026', gen_salt('bf', 10)), true
from public.properties p
where not exists (select 1 from public.staff_accounts s where s.role = 'landlord')
order by p.created_at
limit 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC SUITE
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Staff: permission resolution (roles/permissions) ──────────────────────
-- Landlord always allowed. Caretakers follow the property's staffPermissions
-- metadata (jsonb stored on properties.description until a settings table lands).
create or replace function public.staff_permission_allows(p_staff_role text, p_property uuid, p_action text)
returns boolean
language plpgsql
stable
as $$
declare
  v_settings jsonb;
begin
  if p_staff_role = 'landlord' then return true; end if;
  begin
    select (nullif(p.description, '')::jsonb) -> 'staffPermissions' into v_settings
    from public.properties p where p.id = p_property;
  exception when others then
    v_settings := null; -- description held non-JSON text → default permissions
  end;
  if p_action = 'allocate' then
    return coalesce(v_settings ->> 'canAllocate', 'true')::boolean;
  end if;
  return false;
end;
$$;

-- ── Staff: login ──────────────────────────────────────────────────────────
create or replace function public.staff_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_token uuid;
begin
  select * into v_staff from public.staff_accounts
  where lower(username) = lower(trim(p_username)) and is_active
  limit 1;

  if v_staff.id is null then
    return jsonb_build_object('error','Invalid username or password.');
  end if;

  if v_staff.locked_until is not null and v_staff.locked_until > now() then
    return jsonb_build_object('error', 'Account locked. Try again in ' ||
      ceil(extract(epoch from (v_staff.locked_until - now()))/60)::int || ' minute(s).');
  end if;

  if v_staff.password_hash <> crypt(p_password, v_staff.password_hash) then
    update public.staff_accounts
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where id = v_staff.id;
    return jsonb_build_object('error','Invalid username or password.');
  end if;

  insert into public.staff_sessions (staff_id) values (v_staff.id) returning token into v_token;

  update public.staff_accounts
  set failed_attempts = 0, locked_until = null, updated_at = now()
  where id = v_staff.id;

  return jsonb_build_object(
    'token', v_token,
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'username', v_staff.username,
      'fullName', v_staff.full_name,
      'role', v_staff.role,
      'propertyId', v_staff.property_id
    ),
    'mustChangePassword', v_staff.must_change_password
  );
end;
$$;

-- ── Staff: validate session ───────────────────────────────────────────────
create or replace function public.staff_session(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
begin
  if p_token is null then return jsonb_build_object('valid', false); end if;

  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active
  limit 1;

  if v_staff.id is null then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object(
    'valid', true,
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'username', v_staff.username,
      'fullName', v_staff.full_name,
      'role', v_staff.role,
      'propertyId', v_staff.property_id
    )
  );
end;
$$;

-- ── Staff: logout ─────────────────────────────────────────────────────────
create or replace function public.staff_logout(p_token uuid)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.staff_sessions where token = p_token;
$$;

-- ── Staff: change own password ────────────────────────────────────────────
create or replace function public.staff_change_password(p_token uuid, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff_id uuid;
begin
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('error','Password must be at least 8 characters.');
  end if;

  select ss.staff_id into v_staff_id from public.staff_sessions ss
  where ss.token = p_token and ss.expires_at > now();

  if v_staff_id is null then
    return jsonb_build_object('error','Invalid session.');
  end if;

  update public.staff_accounts
  set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      must_change_password = false
  where id = v_staff_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Staff: property overview (units + tenants + payments in one call) ─────
create or replace function public.staff_overview(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_property uuid;
  v_units jsonb;
  v_payments jsonb;
  v_tenants jsonb;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;

  v_property := v_staff.property_id;

  select coalesce(jsonb_agg(to_jsonb(u) order by u."houseNumber"), '[]'::jsonb) into v_units
  from (
    select u.id, u.house_number as houseNumber, u.unit_type as type,
           u.monthly_rent as monthlyRent, u.deposit as deposit,
           u.booking_deposit as bookingDeposit, u.status, u.size_m2 as sizeM2,
           (u.utilities ->> 'water') as water,
           (u.utilities ->> 'electricity') as electricity,
           ti.full_name as tenantName,
           ti.phone as tenantPhone,
           (ti.onboarding_completed_at is not null) as onboarded
    from public.units u
    left join public.tenant_identities ti on ti.unit_id = u.id
    where u.property_id = v_property
  ) u;

  select coalesce(jsonb_agg(to_jsonb(p) order by p."paidAt" desc), '[]'::jsonb) into v_payments
  from (
    select pay.id, pay.amount, pay.method, pay.status, pay.reference,
           pay.category, pay.paid_at as paidAt, pay.notes,
           ti.full_name as tenantName, u.house_number as houseNumber
    from public.payments pay
    join public.tenant_identities ti on ti.id = pay.tenant_id
    join public.units u on u.id = ti.unit_id
    where ti.property_id = v_property
  ) p;

  select coalesce(jsonb_agg(to_jsonb(t) order by t."houseNumber"), '[]'::jsonb) into v_tenants
  from (
    select ti.id, ti.full_name as fullName, ti.phone, ti.unit_id as unitId,
           u.house_number as houseNumber,
           (ti.onboarding_completed_at is not null) as onboarded,
           ti.created_at as createdAt
    from public.tenant_identities ti
    join public.units u on u.id = ti.unit_id
    where ti.property_id = v_property
  ) t;

  return jsonb_build_object(
    'property', (select jsonb_build_object('id', p.id, 'name', p.name, 'location', p.location)
                 from public.properties p where p.id = v_property),
    'units', v_units,
    'payments', v_payments,
    'tenants', v_tenants
  );
end;
$$;

-- ── Staff: dashboard stats ────────────────────────────────────────────────
create or replace function public.staff_dashboard(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_property uuid;
  v_total int; v_occupied int; v_vacant int; v_maintenance int;
  v_collected numeric; v_expected numeric; v_tenants int; v_pending int;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;
  v_property := v_staff.property_id;

  select count(*) into v_total from public.units where property_id = v_property;
  select count(*) into v_occupied from public.units where property_id = v_property and status = 'occupied';
  select count(*) into v_vacant from public.units where property_id = v_property and status = 'vacant';
  select count(*) into v_maintenance from public.units where property_id = v_property and status = 'maintenance';
  select count(*) into v_tenants from public.tenant_identities where property_id = v_property;

  select coalesce(sum(pay.amount), 0) into v_collected
  from public.payments pay
  join public.tenant_identities ti on ti.id = pay.tenant_id
  where ti.property_id = v_property and pay.status = 'completed';

  select coalesce(sum(u.monthly_rent), 0) into v_expected
  from public.units u where u.property_id = v_property and u.status = 'occupied';

  select count(*) into v_pending from public.maintenance_requests mr
  join public.units u on u.id = mr.unit_id
  where u.property_id = v_property and mr.status in ('submitted','in_review','in_progress');

  return jsonb_build_object(
    'totalUnits', v_total, 'occupied', v_occupied, 'vacant', v_vacant,
    'maintenance', v_maintenance, 'tenants', v_tenants,
    'collected', v_collected, 'expectedMonthly', v_expected, 'pendingRequests', v_pending
  );
end;
$$;

-- ── Staff: allocate a vacant unit (records deposit+rent, returns code) ────
create or replace function public.allocate_unit_v2(
  p_token uuid,
  p_unit_id uuid,
  p_tenant_name text,
  p_tenant_phone text,
  p_deposit_amount numeric,
  p_deposit_method public.payment_method,
  p_deposit_reference text,
  p_rent_amount numeric,
  p_rent_method public.payment_method,
  p_rent_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_property uuid;
  v_tenant uuid;
  v_code text;
  v_code_hash text;
  v_email text;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;

  select property_id into v_property from public.units where id = p_unit_id;
  if v_property is null or v_staff.property_id <> v_property then
    return jsonb_build_object('error','You can only allocate units in your own property.');
  end if;

  if exists (select 1 from public.units where id = p_unit_id and status <> 'vacant') then
    return jsonb_build_object('error','Only vacant units can be allocated.');
  end if;

  if exists (select 1 from public.tenant_identities where unit_id = p_unit_id) then
    return jsonb_build_object('error','This unit already has a tenant.');
  end if;

  if p_deposit_amount is null or p_deposit_amount < 0 or p_rent_amount is null or p_rent_amount < 0 then
    return jsonb_build_object('error','Deposit and rent amounts are required.');
  end if;

  if not public.staff_permission_allows(v_staff.role, v_property, 'allocate') then
    return jsonb_build_object('error','You do not have permission to allocate units. Ask the landlord.');
  end if;

  -- Unique 6-digit code (plaintext lives only in tenant_access_codes + hash on identity)
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.tenant_access_codes where code = v_code);
  end loop;
  v_code_hash := crypt(v_code, gen_salt('bf', 10));

  v_email := 'tenant+' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)) || '@brightstay.local';

  insert into public.tenant_identities
    (property_id, unit_id, full_name, phone, provisioned_email, code_hash, code_expires_at, created_by)
  values
    (v_property, p_unit_id, trim(p_tenant_name), trim(p_tenant_phone), v_email,
     v_code_hash, now() + interval '30 days', v_staff.id)
  returning id into v_tenant;

  insert into public.tenant_access_codes (code, tenant_id, expires_at)
  values (v_code, v_tenant, now() + interval '30 days');

  -- Traceable initial payments (deposit + rent) with method + reference
  insert into public.payments (tenant_id, unit_id, amount, method, status, reference, category, recorded_by_staff)
  values (v_tenant, p_unit_id, p_deposit_amount, p_deposit_method, 'completed',
          nullif(trim(p_deposit_reference), ''), 'deposit', v_staff.id);

  insert into public.payments (tenant_id, unit_id, amount, method, status, reference, category, recorded_by_staff)
  values (v_tenant, p_unit_id, p_rent_amount, p_rent_method, 'completed',
          nullif(trim(p_rent_reference), ''), 'rent', v_staff.id);

  update public.units set status = 'occupied', updated_at = now() where id = p_unit_id;

  insert into public.audit_logs (actor_staff_id, action, entity_type, entity_id, details)
  values (v_staff.id, 'ALLOCATE_UNIT', 'unit', p_unit_id,
          jsonb_build_object('tenant', trim(p_tenant_name), 'deposit', p_deposit_amount, 'rent', p_rent_amount));

  return jsonb_build_object('tenantId', v_tenant, 'accessCode', v_code);
end;
$$;

-- ── Staff: add a vacant unit (landlord or caretaker) ──────────────────
create or replace function public.staff_add_unit(
  p_token uuid, p_house_number text, p_unit_type public.unit_type,
  p_monthly_rent numeric, p_deposit numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_unit_id uuid;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;
  if p_house_number is null or trim(p_house_number) = '' then
    return jsonb_build_object('error','House number is required.');
  end if;
  if p_monthly_rent is null or p_monthly_rent < 0 then
    return jsonb_build_object('error','Monthly rent is required.');
  end if;

  insert into public.units (property_id, house_number, unit_type, monthly_rent, deposit, status)
  values (v_staff.property_id, trim(p_house_number), p_unit_type, p_monthly_rent,
          coalesce(p_deposit, 0), 'vacant')
  returning id into v_unit_id;

  return jsonb_build_object('id', v_unit_id, 'houseNumber', trim(p_house_number));
exception when unique_violation then
  return jsonb_build_object('error','A house with that number already exists.');
end;
$$;

-- ── Staff: create a caretaker account (landlord only) ─────────────────────
create or replace function public.staff_create_caretaker(
  p_token uuid, p_username text, p_full_name text, p_phone text, p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_new_id uuid;
  v_new_username text;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;
  if v_staff.role <> 'landlord' then return jsonb_build_object('error','Only the landlord can add caretakers.'); end if;
  if p_password is null or length(p_password) < 8 then
    return jsonb_build_object('error','Password must be at least 8 characters.');
  end if;
  if p_username is null or trim(p_username) = '' then
    return jsonb_build_object('error','Username is required.');
  end if;

  insert into public.staff_accounts (property_id, username, full_name, phone, role, password_hash, must_change_password)
  values (v_staff.property_id, lower(trim(p_username)), trim(p_full_name), nullif(trim(p_phone), ''), 'caretaker',
          crypt(p_password, gen_salt('bf', 10)), true)
  returning id, username into v_new_id, v_new_username;

  return jsonb_build_object('id', v_new_id, 'username', v_new_username);
end;
$$;

-- ── Staff: toggle caretaker allocate permission (landlord only) ───────────
create or replace function public.staff_set_permission(p_token uuid, p_username text, p_can_allocate boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_target uuid;
  v_settings jsonb;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;
  if v_staff.role <> 'landlord' then return jsonb_build_object('error','Only the landlord can change permissions.'); end if;

  select id into v_target from public.staff_accounts
  where lower(username) = lower(trim(p_username)) and property_id = v_staff.property_id;
  if v_target is null then return jsonb_build_object('error','Caretaker not found.'); end if;

  begin
    select coalesce(nullif(p.description, ''), '{}')::jsonb into v_settings
    from public.properties p where p.id = v_staff.property_id;
  exception when others then
    v_settings := '{}'::jsonb;
  end;
  if v_settings is null or jsonb_typeof(v_settings) <> 'object' then v_settings := '{}'::jsonb; end if;

  v_settings := jsonb_set(v_settings, '{staffPermissions,canAllocate}', to_jsonb(p_can_allocate), true);
  update public.properties set description = v_settings::text where id = v_staff.property_id;

  return jsonb_build_object('ok', true, 'canAllocate', p_can_allocate);
end;
$$;

-- ── Tenant: verify 6-digit code (registry lookup + bcrypt compare) ────────
create or replace function public.tenant_verify_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.tenant_access_codes;
  v_tenant public.tenant_identities;
  v_token uuid;
begin
  if p_code is null or p_code !~ '^\d{6}$' then
    return jsonb_build_object('error','Enter the 6-digit code from your caretaker.');
  end if;

  select * into v_row from public.tenant_access_codes where code = p_code;

  if v_row.code is null then
    return jsonb_build_object('error','Invalid access code.');
  end if;

  if v_row.used_at is not null then
    return jsonb_build_object('error','This code has already been used.');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('error','This code has expired. Ask your caretaker for a new one.');
  end if;

  select * into v_tenant from public.tenant_identities where id = v_row.tenant_id;

  if v_tenant.onboarding_completed_at is not null then
    return jsonb_build_object('error','This tenant is already fully set up.');
  end if;

  if v_tenant.locked_until is not null and v_tenant.locked_until > now() then
    return jsonb_build_object('error','Too many attempts. Try again later.');
  end if;

  -- Defense in depth: bcrypt compare against the identity's code hash
  if v_tenant.code_hash is null or v_tenant.code_hash <> crypt(p_code, v_tenant.code_hash) then
    update public.tenant_identities
    set failed_code_attempts = failed_code_attempts + 1,
        locked_until = case when failed_code_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where id = v_tenant.id;
    return jsonb_build_object('error','Invalid access code.');
  end if;

  -- Success: consume code, mint/reuse the tenant session token
  update public.tenant_access_codes set used_at = now() where code = p_code;
  update public.tenant_identities
  set code_used_at = now(), failed_code_attempts = 0, updated_at = now()
  where id = v_tenant.id;

  insert into public.tenant_sessions (tenant_id) values (v_tenant.id)
  on conflict (tenant_id) do update set updated_at = now()
  returning token into v_token;

  return jsonb_build_object(
    'token', v_token,
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'fullName', v_tenant.full_name,
      'unitId', v_tenant.unit_id,
      'onboardingCompleted', false
    )
  );
end;
$$;

-- ── Tenant: session data (identity + unit + wizard + payments) ────────────
create or replace function public.tenant_session_data(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
  v_tenant public.tenant_identities;
  v_unit public.units;
  v_property public.properties;
  v_steps jsonb;
  v_household jsonb;
  v_emergency jsonb;
  v_payments jsonb;
begin
  if p_token is null then return jsonb_build_object('error','Invalid session.'); end if;

  select ts.tenant_id into v_tenant_id from public.tenant_sessions ts where ts.token = p_token;
  if v_tenant_id is null then return jsonb_build_object('error','Invalid session.'); end if;

  select * into v_tenant from public.tenant_identities where id = v_tenant_id;

  select coalesce(jsonb_object_agg(step, data), '{}'::jsonb) into v_steps
  from public.tenant_onboarding where tenant_id = v_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object('fullName', full_name, 'phone', phone) order by created_at), '[]'::jsonb)
    into v_household from public.tenant_household_members where tenant_id = v_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'relationship', relationship, 'phone', phone, 'county', county) order by created_at), '[]'::jsonb)
    into v_emergency from public.tenant_emergency_contacts where tenant_id = v_tenant_id;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.paidAt), '[]'::jsonb) into v_payments
  from (
    select amount, method, reference, category, status, paid_at as paidAt
    from public.payments where tenant_id = v_tenant_id and status = 'completed'
  ) p;

  select * into v_unit from public.units where id = v_tenant.unit_id;
  select * into v_property from public.properties where id = v_tenant.property_id;

  return jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'fullName', v_tenant.full_name,
      'phone', v_tenant.phone,
      'unitId', v_tenant.unit_id,
      'onboardingCompleted', v_tenant.onboarding_completed_at is not null
    ),
    'unit', case when v_unit.id is null then null else jsonb_build_object(
      'id', v_unit.id, 'houseNumber', v_unit.house_number, 'type', v_unit.unit_type,
      'monthlyRent', v_unit.monthly_rent, 'deposit', v_unit.deposit,
      'bookingDeposit', v_unit.booking_deposit,
      'water', v_unit.utilities ->> 'water',
      'electricity', v_unit.utilities ->> 'electricity'
    ) end,
    'property', case when v_property.id is null then null else jsonb_build_object(
      'id', v_property.id, 'name', v_property.name, 'location', v_property.location
    ) end,
    'steps', v_steps,
    'household', v_household,
    'emergencyContacts', v_emergency,
    'payments', v_payments
  );
end;
$$;

-- ── Tenant: save a wizard step ────────────────────────────────────────────
create or replace function public.tenant_save_step(p_token uuid, p_step int, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant uuid;
  v_name text;
begin
  select ts.tenant_id into v_tenant from public.tenant_sessions ts where ts.token = p_token;
  if v_tenant is null then return jsonb_build_object('error','Invalid session.'); end if;

  if p_step not in (1,2,3) then return jsonb_build_object('error','Unknown step.'); end if;

  insert into public.tenant_onboarding (tenant_id, step, data)
  values (v_tenant, p_step, p_data)
  on conflict (tenant_id, step) do update set data = excluded.data, submitted_at = now();

  -- Step 1 carries the authoritative full name → sync the identity + household
  if p_step = 1 and p_data ->> 'fullNames' is not null then
    v_name := nullif(trim(p_data ->> 'fullNames'), '');
    if v_name is not null then
      update public.tenant_identities set full_name = v_name, updated_at = now() where id = v_tenant;
    end if;

    delete from public.tenant_household_members where tenant_id = v_tenant;
    if jsonb_typeof(p_data -> 'residents') = 'array' then
      insert into public.tenant_household_members (tenant_id, full_name, phone)
      select v_tenant,
             nullif(trim(m ->> 'fullName'), ''),
             nullif(trim(m ->> 'phone'), '')
      from jsonb_array_elements(p_data -> 'residents') m
      where nullif(trim(m ->> 'fullName'), '') is not null;
    end if;
  end if;

  -- Step 3 replaces emergency contacts (≥1 enforced at complete)
  if p_step = 3 and jsonb_typeof(p_data -> 'contacts') = 'array' then
    delete from public.tenant_emergency_contacts where tenant_id = v_tenant;
    insert into public.tenant_emergency_contacts (tenant_id, name, relationship, phone, county)
    select v_tenant,
           nullif(trim(c ->> 'name'), ''),
           coalesce(nullif(trim(c ->> 'relationship'), ''), 'other'),
           nullif(trim(c ->> 'phone'), ''),
           nullif(trim(c ->> 'county'), '')
    from jsonb_array_elements(p_data -> 'contacts') c
    where nullif(trim(c ->> 'name'), '') is not null
      and nullif(trim(c ->> 'phone'), '') is not null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Tenant: complete onboarding (validates all 3 steps) ───────────────────
create or replace function public.tenant_complete(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant uuid;
  v_steps int;
  v_emergency int;
  v_step2 jsonb;
begin
  select ts.tenant_id into v_tenant from public.tenant_sessions ts where ts.token = p_token;
  if v_tenant is null then return jsonb_build_object('error','Invalid session.'); end if;

  select count(*) into v_steps from public.tenant_onboarding where tenant_id = v_tenant;
  if v_steps < 3 then
    return jsonb_build_object('error','Complete all three steps before finishing.');
  end if;

  select count(*) into v_emergency from public.tenant_emergency_contacts where tenant_id = v_tenant;
  if v_emergency < 1 then
    return jsonb_build_object('error','Add at least one emergency contact.');
  end if;

  select data into v_step2 from public.tenant_onboarding where tenant_id = v_tenant and step = 2;
  if v_step2 ->> 'maritalStatus' is null or v_step2 ->> 'occupation' is null or v_step2 ->> 'incomeSource' is null then
    return jsonb_build_object('error','Marital status, occupation and income source are required.');
  end if;

  update public.tenant_identities
  set onboarding_completed_at = now(), updated_at = now()
  where id = v_tenant;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Grants: the RPC suite is callable by anon-carried authenticated sessions ─
grant execute on function
  public.staff_login(text, text),
  public.staff_session(uuid),
  public.staff_logout(uuid),
  public.staff_change_password(uuid, text),
  public.staff_overview(uuid),
  public.staff_dashboard(uuid),
  public.allocate_unit_v2(uuid, uuid, text, text, numeric, public.payment_method, text, numeric, public.payment_method, text),
  public.staff_create_caretaker(uuid, text, text, text, text),
  public.staff_set_permission(uuid, text, boolean),
  public.staff_add_unit(uuid, text, public.unit_type, numeric, numeric),
  public.tenant_verify_code(text),
  public.tenant_session_data(uuid),
  public.tenant_save_step(uuid, int, jsonb),
  public.tenant_complete(uuid)
to anon, authenticated;

revoke execute on function public.staff_permission_allows(text, uuid, text) from anon, authenticated;
