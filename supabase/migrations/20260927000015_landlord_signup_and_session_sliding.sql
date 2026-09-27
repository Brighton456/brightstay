-- ═══════════════════════════════════════════════════════════════════════════
-- BrightStay · migration 0015 — landlord signup + apartment registration,
-- "always stay logged in" sessions, RLS lockdown of auth tables.
--
-- User decisions honoured here:
--   * /manager is the LANDLORD (never labelled "Manager" in UI) login/signup.
--     Landlords sign themselves up and register their apartment(s).
--   * Tenants never sign up; access code only (code path unchanged).
--   * Everyone stays logged in: staff sessions extended to 30 days with
--     sliding renewal (each valid session check adds 30 days back);
--     tenant sessions get the same 30-day sliding renewal.
--   * Security: the 8 table-based auth tables get RLS ENABLED + REVOKE for
--     anon/authenticated — they are only touched through SECURITY DEFINER
--     RPCs, which keep working (definer bypasses RLS/privileges).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sessions: 30-day expiry + sliding renewal ───────────────────────────
alter table public.staff_sessions
  alter column expires_at set default now() + interval '30 days';

-- Tenant sessions had no expiry at all; give them the same 30-day window.
alter table public.tenant_sessions
  add column if not exists expires_at timestamptz not null default now() + interval '30 days';
update public.tenant_sessions set expires_at = now() + interval '30 days';

-- Sliding renewal helper: called on every session check.
create or replace function public.touch_session(p_token uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
begin
  if p_token is null then return; end if;
  update public.staff_sessions
     set expires_at = now() + interval '30 days'
   where token = p_token and expires_at > now();
  update public.tenant_sessions
     set expires_at = now() + interval '30 days',
         updated_at = now()
   where token = p_token and expires_at > now();
end;
$$;

-- Session checks slide the expiry window forward → user stays logged in.
create or replace function public.staff_session(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
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

  perform public.touch_session(p_token);

  return jsonb_build_object(
    'valid', true,
    'mustChangePassword', v_staff.must_change_password,
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

create or replace function public.tenant_session_data(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
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

  select ts.tenant_id into v_tenant_id
  from public.tenant_sessions ts
  where ts.token = p_token and ts.expires_at > now();
  if v_tenant_id is null then return jsonb_build_object('error','Invalid session.'); end if;

  perform public.touch_session(p_token);

  select * into v_tenant from public.tenant_identities where id = v_tenant_id;

  select coalesce(jsonb_object_agg(step, data), '{}'::jsonb) into v_steps
  from public.tenant_onboarding where tenant_id = v_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object('fullName', full_name, 'phone', phone) order by created_at), '[]'::jsonb)
    into v_household from public.tenant_household_members where tenant_id = v_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'relationship', relationship, 'phone', phone, 'county', county) order by created_at), '[]'::jsonb)
    into v_emergency from public.tenant_emergency_contacts where tenant_id = v_tenant_id;

  select coalesce(jsonb_agg(to_jsonb(p) order by p."paidAt"), '[]'::jsonb) into v_payments
  from (
    select amount, method, reference, category, status, paid_at as "paidAt"
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

-- ── 2. Landlord self-service signup + apartment registration ───────────────

-- Has the first landlord signed up yet? (drives /manager first-run UI)
create or replace function public.staff_has_landlord()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (select 1 from public.staff_accounts where role = 'landlord');
$$;

-- Open only while NO landlord account exists (first-run bootstrap).
-- Username + strong password + full name required. must_change_password is
-- FALSE (they chose it themselves — nothing seeded to rotate).
create or replace function public.staff_signup_landlord(
  p_username   text,
  p_password   text,
  p_full_name  text,
  p_phone      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
declare
  v_staff public.staff_accounts;
  v_token uuid;
begin
  if exists (select 1 from public.staff_accounts where role = 'landlord') then
    return jsonb_build_object('error',
      'A landlord account already exists. Ask the landlord to create extra staff accounts.');
  end if;

  p_username  := lower(trim(coalesce(p_username, '')));
  p_full_name := trim(coalesce(p_full_name, ''));
  p_phone     := nullif(trim(coalesce(p_phone, '')), '');

  if p_username !~ '^[a-z0-9._-]{3,32}$' then
    return jsonb_build_object('error',
      'Username must be 3–32 characters: letters, numbers, dots, dashes or underscores.');
  end if;
  if p_full_name = '' then
    return jsonb_build_object('error', 'Your full name is required.');
  end if;
  if p_password is null or length(p_password) < 8 then
    return jsonb_build_object('error', 'Password must be at least 8 characters.');
  end if;
  if p_password !~ '[A-Za-z]' or p_password !~ '\d' then
    return jsonb_build_object('error', 'Password must include letters and numbers.');
  end if;

  begin
    insert into public.staff_accounts (username, full_name, phone, role, password_hash, must_change_password)
    values (p_username, p_full_name, p_phone, 'landlord', crypt(p_password, gen_salt('bf')), false)
    returning * into v_staff;
  exception when unique_violation then
    return jsonb_build_object('error', 'That username is taken. Choose another.');
  end;

  insert into public.staff_sessions (staff_id) values (v_staff.id) returning token into v_token;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_staff.id, 'landlord.signup', 'staff_account', v_staff.id,
          jsonb_build_object('username', p_username));

  return jsonb_build_object(
    'token', v_token,
    'mustChangePassword', false,
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'username', v_staff.username,
      'fullName', v_staff.full_name,
      'role', v_staff.role,
      'propertyId', null
    )
  );
end;
$$;

-- Landlord registers an apartment (property) in their first-run flow.
-- The property row is created by the definer; caretaker_id/created_by stay
-- null (no supabase auth identity exists) and ownership is proven by the
-- landlord staff row, as everywhere else.
create or replace function public.staff_create_property(
  p_token    uuid,
  p_name     text,
  p_location text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
declare
  v_staff public.staff_accounts;
  v_property public.properties;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active;

  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;
  if v_staff.role <> 'landlord' then
    return jsonb_build_object('error','Only the landlord can register an apartment.');
  end if;
  if v_staff.property_id is not null then
    return jsonb_build_object('error','Your account already manages an apartment.');
  end if;

  p_name := trim(coalesce(p_name, ''));
  if length(p_name) < 2 then
    return jsonb_build_object('error', 'Apartment name is required.');
  end if;
  p_location   := nullif(trim(coalesce(p_location, '')), '');
  p_description := nullif(trim(coalesce(p_description, '')), '');

  insert into public.properties (name, location, description)
  values (p_name, p_location, p_description)
  returning * into v_property;

  update public.staff_accounts
     set property_id = v_property.id, updated_at = now()
   where id = v_staff.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_staff.id, 'property.create', 'property', v_property.id,
          jsonb_build_object('name', p_name));

  return jsonb_build_object(
    'property', jsonb_build_object('id', v_property.id, 'name', v_property.name, 'location', v_property.location)
  );
end;
$$;

-- ── 3. Lockdown: RLS on the 8 auth tables ─────────────────────────────────
-- No policies are granted on purpose: these tables are reachable ONLY via
-- SECURITY DEFINER RPCs (definer bypasses RLS), so enabling RLS with zero
-- policies = zero direct client access, while RPC flows keep working.
alter table public.staff_accounts            enable row level security;
alter table public.staff_sessions            enable row level security;
alter table public.tenant_identities         enable row level security;
alter table public.tenant_access_codes       enable row level security;
alter table public.tenant_sessions           enable row level security;
alter table public.tenant_onboarding         enable row level security;
alter table public.tenant_household_members  enable row level security;
alter table public.tenant_emergency_contacts enable row level security;

revoke all on public.staff_accounts            from anon, authenticated;
revoke all on public.staff_sessions            from anon, authenticated;
revoke all on public.tenant_identities         from anon, authenticated;
revoke all on public.tenant_access_codes       from anon, authenticated;
revoke all on public.tenant_sessions           from anon, authenticated;
revoke all on public.tenant_onboarding         from anon, authenticated;
revoke all on public.tenant_household_members  from anon, authenticated;
revoke all on public.tenant_emergency_contacts from anon, authenticated;

-- ── 4. Execute-privilege audit for the auth RPC surface ───────────────────
revoke all on function public.staff_login(text, text)              from public, anon, authenticated;
grant execute on function public.staff_login(text, text)           to anon, authenticated;
revoke all on function public.staff_session(uuid)                  from public, anon, authenticated;
grant execute on function public.staff_session(uuid)               to anon, authenticated;
revoke all on function public.staff_logout(uuid)                   from public, anon, authenticated;
grant execute on function public.staff_logout(uuid)                to anon, authenticated;
revoke all on function public.staff_change_password(uuid, text)    from public, anon, authenticated;
grant execute on function public.staff_change_password(uuid, text) to anon, authenticated;
revoke all on function public.staff_has_landlord()                 from public, anon, authenticated;
grant execute on function public.staff_has_landlord()              to anon, authenticated;
revoke all on function public.staff_signup_landlord(text, text, text, text) from public, anon, authenticated;
grant execute on function public.staff_signup_landlord(text, text, text, text) to anon, authenticated;
revoke all on function public.staff_create_property(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.staff_create_property(uuid, text, text, text) to anon, authenticated;
revoke all on function public.staff_overview(uuid)                 from public, anon, authenticated;
grant execute on function public.staff_overview(uuid)              to anon, authenticated;
revoke all on function public.tenant_verify_code(text)             from public, anon, authenticated;
grant execute on function public.tenant_verify_code(text)          to anon, authenticated;
revoke all on function public.tenant_session_data(uuid)            from public, anon, authenticated;
grant execute on function public.tenant_session_data(uuid)         to anon, authenticated;
revoke all on function public.touch_session(uuid)                  from public, anon, authenticated;
grant execute on function public.touch_session(uuid)               to anon, authenticated;
-- staff_overview internal helpers stay non-public where they exist
revoke all on function public.staff_permission_allows(text, uuid, text)  from public, anon, authenticated;
revoke all on function public.staff_dashboard(uuid)               from public, anon, authenticated;
grant execute on function public.staff_dashboard(uuid)            to anon, authenticated;
revoke all on function public.tenant_save_step(uuid, int, jsonb)   from public, anon, authenticated;
grant execute on function public.tenant_save_step(uuid, int, jsonb) to anon, authenticated;
revoke all on function public.tenant_complete(uuid)                from public, anon, authenticated;
grant execute on function public.tenant_complete(uuid)             to anon, authenticated;
revoke all on function public.allocate_unit_v2(uuid, uuid, text, text, numeric, payment_method, text, numeric, payment_method, text) from public, anon, authenticated;
grant execute on function public.allocate_unit_v2(uuid, uuid, text, text, numeric, payment_method, text, numeric, payment_method, text) to anon, authenticated;
revoke all on function public.staff_add_unit(uuid, text, unit_type, numeric, numeric) from public, anon, authenticated;
grant execute on function public.staff_add_unit(uuid, text, unit_type, numeric, numeric) to anon, authenticated;
revoke all on function public.staff_create_caretaker(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.staff_create_caretaker(uuid, text, text, text, text) to anon, authenticated;
revoke all on function public.staff_set_permission(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.staff_set_permission(uuid, text, boolean) to anon, authenticated;

-- ── 5. Grant legacy seeded account a live session window ──────────────────
-- (sessions created before this migration had 12h windows; new logins get 30d)
update public.staff_sessions set expires_at = now() + interval '30 days' where expires_at > now();
