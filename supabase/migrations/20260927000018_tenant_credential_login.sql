-- ═══════════════════════════════════════════════════════════════════════════
-- BrightStay · migration 0018 — tenant username/password login
--
-- Problem: tenants log in once with a 6-digit access code; if the browser
-- session is lost (new device, cleared storage) they could never log back in.
--
-- Fix (mirrors the staff_accounts credential pattern):
--   * tenant_identities.username (unique) + password_hash (bcrypt)
--   * tenant_login(p_username, p_password) → session token (same 30-day
--     sliding window, same 5-fails → 15-min lockout as staff)
--   * staff_set_tenant_credentials — landlord-gated reset (returns ok +
--     username only; the password is never logged)
--   * allocate_unit_v2 now mints credentials for every NEW tenant too, and
--     returns them alongside the access code
--   * one-time backfill assigns credentials to tenants created before this
--     migration (passwords are reported to the landlord once, never stored
--     in plaintext)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columns ─────────────────────────────────────────────────────────────
alter table public.tenant_identities
  add column if not exists username text;
alter table public.tenant_identities
  add column if not exists password_hash text;

-- Case-insensitive uniqueness (login matches lower(username)).
create unique index if not exists idx_tenant_identities_username
  on public.tenant_identities (lower(username)) where username is not null;

alter table public.tenant_identities
  add constraint tenant_identities_username_format
  check (username is null or username ~ '^[a-z0-9._-]{3,40}$');

-- ── 2. tenant_login — credential login for tenants ─────────────────────────
create or replace function public.tenant_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_t public.tenant_identities;
  v_token uuid;
begin
  if p_username is null or p_password is null or length(trim(p_username)) = 0 then
    return jsonb_build_object('error','Enter your username and password.');
  end if;

  select * into v_t from public.tenant_identities
  where lower(username) = lower(trim(p_username))
  limit 1;

  if v_t.id is null then
    return jsonb_build_object('error','Invalid username or password.');
  end if;

  if v_t.locked_until is not null and v_t.locked_until > now() then
    return jsonb_build_object('error','Account locked. Try again in ' ||
      ceil(extract(epoch from (v_t.locked_until - now()))/60)::int || ' minute(s).');
  end if;

  if v_t.password_hash is null or v_t.password_hash <> crypt(p_password, v_t.password_hash) then
    update public.tenant_identities
    set failed_code_attempts = failed_code_attempts + 1,
        locked_until = case when failed_code_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where id = v_t.id;
    return jsonb_build_object('error','Invalid username or password.');
  end if;

  -- Success: mint/reuse the tenant session token (30-day sliding window,
  -- same as touch_session grants on session checks).
  insert into public.tenant_sessions (tenant_id) values (v_t.id)
  on conflict (tenant_id) do update
    set updated_at = now(), expires_at = now() + interval '30 days'
  returning token into v_token;

  update public.tenant_identities
  set failed_code_attempts = 0, locked_until = null, updated_at = now()
  where id = v_t.id;

  return jsonb_build_object(
    'token', v_token,
    'tenant', jsonb_build_object(
      'id', v_t.id,
      'fullName', v_t.full_name,
      'unitId', v_t.unit_id,
      'onboardingCompleted', v_t.onboarding_completed_at is not null
    )
  );
end;
$$;

-- ── 3. staff_set_tenant_credentials — landlord-gated reset ─────────────────
create or replace function public.staff_set_tenant_credentials(
  p_token uuid, p_tenant_id uuid, p_username text, p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.staff_accounts;
  v_tenant public.tenant_identities;
  v_username text;
begin
  select s.* into v_staff
  from public.staff_sessions ss
  join public.staff_accounts s on s.id = ss.staff_id
  where ss.token = p_token and ss.expires_at > now() and s.is_active
  limit 1;
  if v_staff.id is null then return jsonb_build_object('error','Invalid session.'); end if;
  if v_staff.role <> 'landlord' then
    return jsonb_build_object('error','Only the landlord can set tenant credentials.');
  end if;

  select * into v_tenant from public.tenant_identities where id = p_tenant_id;
  if v_tenant.id is null then return jsonb_build_object('error','Tenant not found.'); end if;
  if v_tenant.property_id <> v_staff.property_id then
    return jsonb_build_object('error','You can only manage tenants in your own property.');
  end if;

  v_username := lower(regexp_replace(trim(coalesce(p_username, '')), '[^a-zA-Z0-9._-]', '', 'g'));
  if v_username is null or v_username !~ '^[a-z0-9._-]{3,40}$' then
    return jsonb_build_object('error','Username must be 3-40 characters (letters, numbers, dot, underscore, dash).');
  end if;
  if p_password is null or length(p_password) < 6 then
    return jsonb_build_object('error','Password must be at least 6 characters.');
  end if;

  if exists (
    select 1 from public.tenant_identities t
    where lower(t.username) = v_username and t.id <> v_tenant.id
  ) then
    return jsonb_build_object('error','That username is already taken.');
  end if;

  update public.tenant_identities
  set username = v_username,
      password_hash = crypt(p_password, gen_salt('bf', 10)),
      failed_code_attempts = 0,
      locked_until = null,
      updated_at = now()
  where id = v_tenant.id;

  insert into public.audit_logs (actor_staff_id, action, entity_type, entity_id, details)
  values (v_staff.id, 'SET_TENANT_CREDENTIALS', 'tenant', v_tenant.id,
          jsonb_build_object('username', v_username));

  return jsonb_build_object('ok', true, 'username', v_username);
end;
$$;

-- ── 4. allocate_unit_v2 — mint credentials for every new tenant ────────────
CREATE OR REPLACE FUNCTION public.allocate_unit_v2(p_token uuid, p_unit_id uuid, p_tenant_name text, p_tenant_phone text, p_deposit_amount numeric, p_deposit_method payment_method, p_deposit_reference text, p_rent_amount numeric, p_rent_method payment_method, p_rent_reference text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
  v_property uuid;
  v_tenant uuid;
  v_code text;
  v_code_hash text;
  v_email text;
  v_conf_dep jsonb;
  v_conf_rent jsonb;
  v_status_dep text;
  v_status_rent text;
  v_username text;
  v_password text;
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss
  JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;

  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT property_id INTO v_property FROM public.units WHERE id = p_unit_id;
  IF v_property IS NULL OR v_staff.property_id <> v_property THEN
    RETURN jsonb_build_object('error','You can only allocate units in your own property.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.units WHERE id = p_unit_id AND status <> 'vacant') THEN
    RETURN jsonb_build_object('error','Only vacant units can be allocated.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenant_identities WHERE unit_id = p_unit_id) THEN
    RETURN jsonb_build_object('error','This unit already has a tenant.');
  END IF;

  IF p_deposit_amount IS NULL OR p_deposit_amount < 0 OR p_rent_amount IS NULL OR p_rent_amount < 0 THEN
    RETURN jsonb_build_object('error','Deposit and rent amounts are required.');
  END IF;

  IF NOT public.staff_permission_allows(v_staff.role, v_property, 'allocate') THEN
    RETURN jsonb_build_object('error','You do not have permission to allocate units. Ask the landlord.');
  END IF;

  LOOP
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tenant_access_codes WHERE code = v_code);
  END LOOP;
  v_code_hash := crypt(v_code, gen_salt('bf', 10));

  v_email := 'tenant+' || lower(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 12)) || '@brightstay.local';

  -- Credential login: username = phone digits (fallback: name slug), unique
  -- temp password (8 chars). Reported to staff alongside the access code;
  -- only the bcrypt hash is stored.
  v_username := lower(regexp_replace(TRIM(coalesce(p_tenant_phone, '')), '[^0-9a-zA-Z]', '', 'g'));
  IF v_username IS NULL OR length(v_username) < 3 THEN
    v_username := lower(regexp_replace(TRIM(coalesce(p_tenant_name, '')), '[^a-zA-Z0-9]', '', 'g'));
  END IF;
  IF v_username IS NULL OR length(v_username) < 3 THEN
    v_username := 'tenant' || lower(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
  END IF;
  IF length(v_username) > 40 THEN v_username := substring(v_username FROM 1 FOR 40); END IF;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tenant_identities ti WHERE lower(ti.username) = v_username);
    v_username := substring(v_username FROM 1 FOR 31) || '-' || lower(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 4));
  END LOOP;
  v_password := substring(encode(gen_random_bytes(6), 'hex') FROM 1 FOR 8);

  INSERT INTO public.tenant_identities
    (property_id, unit_id, full_name, phone, provisioned_email, code_hash, code_expires_at, created_by, username, password_hash)
  VALUES
    (v_property, p_unit_id, TRIM(p_tenant_name), TRIM(p_tenant_phone), v_email,
     v_code_hash, now() + interval '30 days', v_staff.id, v_username,
     crypt(v_password, gen_salt('bf', 10)))
  RETURNING id INTO v_tenant;

  INSERT INTO public.tenant_access_codes (code, tenant_id, expires_at)
  VALUES (v_code, v_tenant, now() + interval '30 days');

  -- Confirmation workflow: landlord-recorded = confirmed; staff-recorded
  -- cash/M-Pesa = awaiting landlord (cash holder / approval), per landlord rule.
  IF v_staff.role = 'landlord' THEN
    v_status_dep := 'confirmed'; v_conf_dep := jsonb_build_object('recordedByName', v_staff.full_name, 'recordedByRole', 'landlord');
    v_status_rent := 'confirmed'; v_conf_rent := jsonb_build_object('recordedByName', v_staff.full_name, 'recordedByRole', 'landlord');
  ELSE
    v_status_dep := 'awaiting_landlord';
    v_conf_dep := jsonb_build_object('recordedByName', v_staff.full_name, 'recordedByRole', 'caretaker');
    IF p_deposit_method = 'Cash' THEN v_conf_dep := v_conf_dep || jsonb_build_object('cashHolder', v_staff.full_name); END IF;
    IF p_deposit_method = 'M-Pesa' THEN v_conf_dep := v_conf_dep || jsonb_build_object('awaitingAction', 'approval'); END IF;
    v_status_rent := 'awaiting_landlord';
    v_conf_rent := jsonb_build_object('recordedByName', v_staff.full_name, 'recordedByRole', 'caretaker');
    IF p_rent_method = 'Cash' THEN v_conf_rent := v_conf_rent || jsonb_build_object('cashHolder', v_staff.full_name); END IF;
    IF p_rent_method = 'M-Pesa' THEN v_conf_rent := v_conf_rent || jsonb_build_object('awaitingAction', 'approval'); END IF;
  END IF;

  INSERT INTO public.payments (tenant_id, unit_id, amount, method, status, reference, category, recorded_by, confirmation_status, confirmation)
  VALUES (v_tenant, p_unit_id, p_deposit_amount, p_deposit_method, 'completed',
          NULLIF(TRIM(p_deposit_reference), ''), 'deposit', v_staff.id, v_status_dep, v_conf_dep);

  INSERT INTO public.payments (tenant_id, unit_id, amount, method, status, reference, category, recorded_by, confirmation_status, confirmation)
  VALUES (v_tenant, p_unit_id, p_rent_amount, p_rent_method, 'completed',
          NULLIF(TRIM(p_rent_reference), ''), 'rent', v_staff.id, v_status_rent, v_conf_rent);

  UPDATE public.units SET status = 'occupied', updated_at = now() WHERE id = p_unit_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_staff.id, 'ALLOCATE_UNIT', 'unit', p_unit_id,
          jsonb_build_object('tenant', TRIM(p_tenant_name), 'deposit', p_deposit_amount, 'rent', p_rent_amount));

  RETURN jsonb_build_object('tenantId', v_tenant, 'accessCode', v_code,
                            'username', v_username, 'tempPassword', v_password);
END;
$fn$;

-- ── 5. Backfill: credentials for tenants created before this migration ─────
-- Usernames from phone digits; passwords were generated once and reported to
-- the landlord (never stored in plaintext).
UPDATE public.tenant_identities t
SET username = v.username,
    password_hash = crypt(v.password, gen_salt('bf', 10)),
    updated_at = now()
FROM (VALUES
  ('50344ce0-25eb-4fcd-84c7-d48eacab9502'::uuid, '0712345678', 'f492577a'),
  ('9dd78e19-974a-421a-b27c-12d897d2d245'::uuid, '0720363215', 'cd7c7afa'),
  ('0512eb7b-c7da-40f1-8ed5-6b1f41eb0d92'::uuid, '0791368534', 'db84bd0b')
) AS v(id, username, password)
WHERE t.id = v.id AND t.username IS NULL;

-- ── 6. Grants ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.tenant_login(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.tenant_login(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_set_tenant_credentials(uuid,uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_set_tenant_credentials(uuid,uuid,text,text) TO anon, authenticated;
