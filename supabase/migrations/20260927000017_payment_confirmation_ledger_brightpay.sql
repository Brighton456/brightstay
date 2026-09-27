-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — Payment confirmation workflow + rent ledger + BrightPay + requests
-- Rules (per landlord):
--   • Cash  recorded by staff   → confirmation_status 'awaiting_landlord'
--       confirmation.cashHolder = staff name; landlord marks "received".
--   • M-Pesa recorded by staff  → 'awaiting_landlord'; landlord approves.
--   • System payments (BrightPay STK, auto) → 'auto_confirmed'.
--   • Payments recorded by the landlord themselves → 'confirmed'.
-- Rent ledger: FIFO allocation of completed rent payments across months.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. payments confirmation columns ───────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'auto_confirmed',
  ADD COLUMN IF NOT EXISTS confirmation jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_confirmation_status_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_confirmation_status_check
      CHECK (confirmation_status IN ('auto_confirmed', 'awaiting_landlord', 'confirmed'));
  END IF;
END $$;

-- Legacy rows were staff-recorded completed payments at allocation: treat as
-- already handled by the landlord (historical), not "awaiting".
UPDATE public.payments SET confirmation_status = 'confirmed' WHERE confirmation_status = 'auto_confirmed';

-- ── 2. rent ledger helper (internal — revoked from clients) ────────────────
CREATE OR REPLACE FUNCTION public.rent_ledger_for_tenant(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_tenant public.tenant_identities;
  v_unit public.units;
  v_lease public.leases;
  v_start date;
  v_end_month date;
  v_rent numeric;
  v_m date;
  v_amounts numeric[];
  v_left numeric;
  v_i int;
  v_n int;
  v_month_due numeric;
  v_month_paid numeric;
  v_months jsonb := '[]'::jsonb;
  v_paid_cnt int := 0;
  v_partial_cnt int := 0;
  v_unpaid_cnt int := 0;
  v_outstanding numeric := 0;
  v_advance numeric := 0;
  v_j int;
BEGIN
  SELECT * INTO v_tenant FROM public.tenant_identities WHERE id = p_tenant;
  IF v_tenant.id IS NULL THEN RETURN jsonb_build_object('months', '[]'::jsonb); END IF;
  SELECT * INTO v_unit FROM public.units WHERE id = v_tenant.unit_id;

  SELECT * INTO v_lease FROM public.leases
   WHERE unit_id = v_tenant.unit_id AND tenant_id = v_tenant.id AND status = 'active'
   ORDER BY start_date LIMIT 1;

  v_start     := COALESCE(v_lease.start_date, date_trunc('month', v_tenant.created_at)::date);
  v_rent      := COALESCE(v_lease.monthly_rent, v_unit.monthly_rent, 0);
  v_end_month := date_trunc('month', now())::date;

  SELECT array_agg(p.amount ORDER BY p.paid_at, p.created_at),
         count(*)
    INTO v_amounts, v_n
  FROM public.payments p
  WHERE p.tenant_id = p_tenant AND p.category = 'rent' AND p.status = 'completed';
  v_amounts := COALESCE(v_amounts, '{}'::numeric[]);
  v_i := 1;

  v_m := v_start;
  WHILE v_m <= v_end_month LOOP
    v_month_due  := v_rent;
    v_month_paid := 0;
    WHILE v_month_due > 0 AND v_i <= v_n LOOP
      v_left := v_amounts[v_i];
      IF v_left IS NULL OR v_left <= 0 THEN
        v_i := v_i + 1;
        CONTINUE;
      END IF;
      IF v_left >= v_month_due THEN
        v_amounts[v_i] := v_left - v_month_due;
        v_month_paid   := v_month_paid + v_month_due;
        v_month_due    := 0;
      ELSE
        v_month_due    := v_month_due - v_left;
        v_month_paid   := v_month_paid + v_left;
        v_amounts[v_i] := 0;
        v_i            := v_i + 1;
      END IF;
    END LOOP;

    IF v_rent = 0 THEN
      v_months := v_months || jsonb_build_object(
        'period', to_char(v_m, 'YYYY-MM'), 'label', to_char(v_m, 'Mon YYYY'),
        'due', 0, 'paid', 0, 'status', 'paid');
      v_paid_cnt := v_paid_cnt + 1;
    ELSIF v_month_due = 0 THEN
      v_months := v_months || jsonb_build_object(
        'period', to_char(v_m, 'YYYY-MM'), 'label', to_char(v_m, 'Mon YYYY'),
        'due', v_rent, 'paid', v_month_paid, 'status', 'paid');
      v_paid_cnt := v_paid_cnt + 1;
    ELSIF v_month_paid > 0 THEN
      v_months := v_months || jsonb_build_object(
        'period', to_char(v_m, 'YYYY-MM'), 'label', to_char(v_m, 'Mon YYYY'),
        'due', v_rent, 'paid', v_month_paid, 'status', 'partial');
      v_partial_cnt  := v_partial_cnt + 1;
      v_outstanding  := v_outstanding + (v_rent - v_month_paid);
    ELSE
      v_months := v_months || jsonb_build_object(
        'period', to_char(v_m, 'YYYY-MM'), 'label', to_char(v_m, 'Mon YYYY'),
        'due', v_rent, 'paid', 0, 'status', 'unpaid');
      v_unpaid_cnt   := v_unpaid_cnt + 1;
      v_outstanding  := v_outstanding + v_rent;
    END IF;

    v_m := (v_m + interval '1 month')::date;
  END LOOP;

  -- leftover credits beyond the current month = paid in advance
  FOR v_j IN v_i..v_n LOOP
    v_advance := v_advance + COALESCE(v_amounts[v_j], 0);
  END LOOP;

  RETURN jsonb_build_object(
    'months', v_months,
    'summary', jsonb_build_object(
      'monthsPaid', v_paid_cnt,
      'monthsPartial', v_partial_cnt,
      'monthsUnpaid', v_unpaid_cnt,
      'outstanding', v_outstanding,
      'advance', v_advance,
      'monthlyRent', v_rent
    )
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rent_ledger_for_tenant(uuid) FROM anon, authenticated, public;

-- ── 3. staff_record_payment ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_record_payment(
  p_token uuid, p_tenant_id uuid, p_amount numeric, p_category text,
  p_method text, p_reference text, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
  v_tenant public.tenant_identities;
  v_method payment_method;
  v_conf_status text;
  v_conf jsonb := '{}'::jsonb;
  v_payment uuid;
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;
  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT * INTO v_tenant FROM public.tenant_identities WHERE id = p_tenant_id;
  IF v_tenant.id IS NULL OR v_tenant.property_id <> v_staff.property_id THEN
    RETURN jsonb_build_object('error','Tenant not found in your property.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('error','Amount must be greater than zero.');
  END IF;
  IF p_category NOT IN ('rent','deposit','booking','other') THEN
    RETURN jsonb_build_object('error','Invalid category.');
  END IF;
  BEGIN
    v_method := p_method::payment_method;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('error','Invalid payment method.');
  END;

  IF v_staff.role = 'landlord' THEN
    v_conf_status := 'confirmed';
    v_conf := jsonb_build_object('recordedByName', v_staff.full_name,
                                 'recordedByRole', 'landlord');
  ELSE
    v_conf_status := 'awaiting_landlord';
    v_conf := jsonb_build_object('recordedByName', v_staff.full_name,
                                 'recordedByRole', 'caretaker');
    IF v_method = 'Cash' THEN
      v_conf := v_conf || jsonb_build_object('cashHolder', v_staff.full_name);
    ELSIF v_method = 'M-Pesa' THEN
      v_conf := v_conf || jsonb_build_object('awaitingAction', 'approval');
    END IF;
  END IF;

  INSERT INTO public.payments
    (tenant_id, unit_id, amount, method, status, reference, category, recorded_by_staff, paid_at, notes, confirmation_status, confirmation)
  VALUES
    (v_tenant.id, v_tenant.unit_id, p_amount, v_method, 'completed',
     NULLIF(TRIM(p_reference), ''), p_category, v_staff.id, now(),
     NULLIF(TRIM(p_notes), ''), v_conf_status, v_conf)
  RETURNING id INTO v_payment;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_staff.id, 'RECORD_PAYMENT', 'payment', v_payment,
          jsonb_build_object('tenant', v_tenant.full_name, 'amount', p_amount,
                             'method', v_method, 'category', p_category));

  RETURN jsonb_build_object('paymentId', v_payment);
END;
$fn$;

-- ── 4. staff_payment_action (landlord-only approve / receive) ──────────────
CREATE OR REPLACE FUNCTION public.staff_payment_action(
  p_token uuid, p_payment_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
  v_pay public.payments;
  v_tenant public.tenant_identities;
  v_iso text := to_char(clock_timestamp() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;
  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;
  IF v_staff.role <> 'landlord' THEN
    RETURN jsonb_build_object('error','Only the landlord can confirm payments.');
  END IF;

  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN RETURN jsonb_build_object('error','Payment not found.'); END IF;

  SELECT * INTO v_tenant FROM public.tenant_identities WHERE id = v_pay.tenant_id;
  IF v_tenant.property_id <> v_staff.property_id THEN
    RETURN jsonb_build_object('error','Payment is outside your property.');
  END IF;

  IF v_pay.confirmation_status <> 'awaiting_landlord' THEN
    RETURN jsonb_build_object('error','This payment is not awaiting confirmation.');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.payments SET confirmation_status = 'confirmed',
      confirmation = confirmation || jsonb_build_object(
        'approvedBy', v_staff.full_name, 'approvedAt', v_iso)
    WHERE id = v_pay.id;
  ELSIF p_action = 'receive' THEN
    UPDATE public.payments SET confirmation_status = 'confirmed',
      confirmation = confirmation || jsonb_build_object(
        'receivedBy', v_staff.full_name, 'receivedAt', v_iso)
    WHERE id = v_pay.id;
  ELSE
    RETURN jsonb_build_object('error','Unknown action.');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_staff.id, upper(p_action) || '_PAYMENT', 'payment', v_pay.id,
          jsonb_build_object('amount', v_pay.amount, 'method', v_pay.method));

  RETURN jsonb_build_object('ok', true, 'paymentId', v_pay.id);
END;
$fn$;

-- ── 5. staff_request_update ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_request_update(
  p_token uuid, p_request_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
  v_unit uuid;
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;
  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT mr.unit_id INTO v_unit FROM public.maintenance_requests mr
  JOIN public.units u ON u.id = mr.unit_id
  WHERE mr.id = p_request_id AND u.property_id = v_staff.property_id;
  IF v_unit IS NULL THEN RETURN jsonb_build_object('error','Request not found.'); END IF;

  IF p_status NOT IN ('submitted','in_review','in_progress','completed','closed') THEN
    RETURN jsonb_build_object('error','Invalid status.');
  END IF;

  UPDATE public.maintenance_requests SET status = p_status::request_status,
    resolved_at = CASE WHEN p_status IN ('completed','closed') THEN now() ELSE resolved_at END,
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_staff.id, 'REQUEST_STATUS', 'maintenance_request', p_request_id,
          jsonb_build_object('status', p_status));

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- ── 6. staff_save_settings (landlord-only, merges into properties.description jsonb) ──
CREATE OR REPLACE FUNCTION public.staff_save_settings(p_token uuid, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
  v_existing jsonb;
  v_merged jsonb;
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;
  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;
  IF v_staff.role <> 'landlord' THEN
    RETURN jsonb_build_object('error','Only the landlord can change platform settings.');
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RETURN jsonb_build_object('error','Settings must be a JSON object.');
  END IF;

  SELECT description INTO v_existing FROM public.properties WHERE id = v_staff.property_id;
  BEGIN
    v_existing := NULLIF(v_existing, '')::jsonb;
  EXCEPTION WHEN others THEN
    -- description held plain text: keep it as a note, start fresh JSON
    v_existing := jsonb_build_object('notes', v_existing);
  END;

  v_merged := COALESCE(v_existing, '{}'::jsonb) || p_settings;
  UPDATE public.properties SET description = v_merged::text, updated_at = now()
  WHERE id = v_staff.property_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_staff.id, 'SAVE_SETTINGS', 'property', v_staff.property_id,
          jsonb_build_object('keys', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_settings) AS k)));

  RETURN jsonb_build_object('ok', true, 'settings', v_merged);
END;
$fn$;

-- ── 7. staff_update_profile ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_update_profile(p_token uuid, p_full_name text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;
  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;
  IF p_full_name IS NULL OR LENGTH(TRIM(p_full_name)) < 2 THEN
    RETURN jsonb_build_object('error','Please enter your full name.');
  END IF;

  UPDATE public.staff_accounts SET full_name = TRIM(p_full_name), phone = NULLIF(TRIM(p_phone), ''), updated_at = now()
  WHERE id = v_staff.id;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- ── 8. tenant_create_request + tenant_fetch_requests ───────────────────────
CREATE OR REPLACE FUNCTION public.tenant_create_request(
  p_token uuid, p_category request_category, p_priority request_priority,
  p_title text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_tenant_id uuid;
  v_unit uuid;
  v_id uuid;
BEGIN
  SELECT ts.tenant_id INTO v_tenant_id FROM public.tenant_sessions ts
  WHERE ts.token = p_token AND ts.expires_at > now();
  IF v_tenant_id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT unit_id INTO v_unit FROM public.tenant_identities WHERE id = v_tenant_id;
  IF v_unit IS NULL THEN RETURN jsonb_build_object('error','No unit on your profile.'); END IF;

  IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 3 THEN
    RETURN jsonb_build_object('error','Please give the request a short title.');
  END IF;

  INSERT INTO public.maintenance_requests (unit_id, tenant_id, category, priority, title, description)
  VALUES (v_unit, v_tenant_id, p_category, p_priority, TRIM(p_title), NULLIF(TRIM(p_description), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('requestId', v_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tenant_fetch_requests(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_tenant_id uuid;
  v_rows jsonb;
BEGIN
  SELECT ts.tenant_id INTO v_tenant_id FROM public.tenant_sessions ts
  WHERE ts.token = p_token AND ts.expires_at > now();
  IF v_tenant_id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r."createdAt" DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT id, category, priority, title, description, status,
           created_at AS "createdAt", resolved_at AS "resolvedAt"
    FROM public.maintenance_requests WHERE tenant_id = v_tenant_id
  ) r;

  RETURN jsonb_build_object('requests', v_rows);
END;
$fn$;

-- ── 9. BrightPay (system M-Pesa STK) — initiate + report status ────────────
CREATE OR REPLACE FUNCTION public.tenant_brightpay_initiate(
  p_token uuid, p_amount numeric, p_phone text, p_category text, p_external_reference text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_tenant_id uuid;
  v_unit uuid;
  v_payment uuid;
  v_digits text;
BEGIN
  SELECT ts.tenant_id INTO v_tenant_id FROM public.tenant_sessions ts
  WHERE ts.token = p_token AND ts.expires_at > now();
  IF v_tenant_id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT unit_id INTO v_unit FROM public.tenant_identities WHERE id = v_tenant_id;

  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN jsonb_build_object('error','Enter an amount of at least KES 1.');
  END IF;
  IF p_category NOT IN ('rent','deposit','booking','other') THEN
    RETURN jsonb_build_object('error','Invalid category.');
  END IF;

  v_digits := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_digits NOT SIMILAR TO '(0|254)?(7|1)[0-9]{8}' THEN
    RETURN jsonb_build_object('error','Enter a valid Safaricom M-Pesa number (07…, 01… or 2547…).');
  END IF;
  IF p_external_reference IS NULL OR LENGTH(TRIM(p_external_reference)) < 8 THEN
    RETURN jsonb_build_object('error','Missing payment reference.');
  END IF;

  INSERT INTO public.payments
    (tenant_id, unit_id, amount, method, status, reference, category, paid_at, notes, confirmation_status, confirmation)
  VALUES
    (v_tenant_id, v_unit, p_amount, 'M-Pesa', 'pending', TRIM(p_external_reference), p_category, now(),
     'BrightPay M-Pesa — initiated', 'auto_confirmed',
     jsonb_build_object('system', true, 'externalReference', TRIM(p_external_reference),
                        'initiatedAt', to_char(clock_timestamp() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
  RETURNING id INTO v_payment;

  RETURN jsonb_build_object('paymentId', v_payment, 'externalReference', TRIM(p_external_reference));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tenant_brightpay_status(
  p_token uuid, p_payment_id uuid, p_status text, p_receipt text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_tenant_id uuid;
  v_pay public.payments;
  v_iso text := to_char(clock_timestamp() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  SELECT ts.tenant_id INTO v_tenant_id FROM public.tenant_sessions ts
  WHERE ts.token = p_token AND ts.expires_at > now();
  IF v_tenant_id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT * INTO v_pay FROM public.payments
  WHERE id = p_payment_id AND tenant_id = v_tenant_id;
  IF v_pay.id IS NULL THEN RETURN jsonb_build_object('error','Payment not found.'); END IF;
  IF v_pay.status <> 'pending' THEN RETURN jsonb_build_object('ok', true); END IF;

  IF p_status = 'completed' THEN
    UPDATE public.payments SET status = 'completed',
      reference = COALESCE(NULLIF(TRIM(p_receipt), ''), reference),
      notes = 'BrightPay M-Pesa — confirmed',
      confirmation = confirmation || jsonb_build_object('mpesaReceipt', p_receipt, 'confirmedAt', v_iso)
    WHERE id = v_pay.id;
  ELSIF p_status = 'failed' THEN
    UPDATE public.payments SET status = 'failed',
      notes = 'BrightPay M-Pesa — payment failed',
      confirmation = confirmation || jsonb_build_object('failedAt', v_iso)
    WHERE id = v_pay.id;
  ELSE
    RETURN jsonb_build_object('error','Unknown status.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- ── 10. staff_overview — enriched (confirmation state, ledger, wizard, requests, settings) ──
CREATE OR REPLACE FUNCTION public.staff_overview(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_staff public.staff_accounts;
  v_property uuid;
  v_units jsonb;
  v_payments jsonb;
  v_tenants jsonb;
  v_staff_list jsonb;
  v_requests jsonb;
  v_settings jsonb;
  v_summary jsonb;
BEGIN
  SELECT s.* INTO v_staff
  FROM public.staff_sessions ss JOIN public.staff_accounts s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now() AND s.is_active;
  IF v_staff.id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  v_property := v_staff.property_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u."houseNumber"), '[]'::jsonb) INTO v_units
  FROM (
    SELECT u.id, u.house_number AS "houseNumber", u.unit_type AS "type",
           u.monthly_rent AS "monthlyRent", u.deposit AS "deposit",
           u.booking_deposit AS "bookingDeposit", u.status, u.size_m2 AS "sizeM2",
           (u.utilities ->> 'water') AS "water",
           (u.utilities ->> 'electricity') AS "electricity",
           ti.full_name AS "tenantName", ti.phone AS "tenantPhone",
           ti.id AS "tenantId",
           (ti.onboarding_completed_at IS NOT NULL) AS "onboarded"
    FROM public.units u
    LEFT JOIN public.tenant_identities ti ON ti.unit_id = u.id
    WHERE u.property_id = v_property
  ) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p."paidAt" DESC), '[]'::jsonb) INTO v_payments
  FROM (
    SELECT pay.id, pay.amount, pay.method, pay.status, pay.reference,
           pay.category, pay.paid_at AS "paidAt", pay.notes,
           pay.tenant_id AS "tenantId", pay.unit_id AS "unitId",
           pay.recorded_by_staff AS "recordedByStaffId",
           COALESCE(pay.recorded_by_staff, pay.recorded_by) AS "recordedBy",
           sa.full_name AS "recordedByName", sa.role AS "recordedByRole",
           pay.confirmation_status AS "confirmationStatus",
           pay.confirmation AS "confirmation",
           pay.created_at AS "createdAt",
           ti.full_name AS "tenantName", ti.phone AS "tenantPhone",
           u.house_number AS "houseNumber"
    FROM public.payments pay
    JOIN public.tenant_identities ti ON ti.id = pay.tenant_id
    JOIN public.units u ON u.id = ti.unit_id
    LEFT JOIN public.staff_accounts sa ON sa.id = COALESCE(pay.recorded_by_staff, pay.recorded_by)
    WHERE ti.property_id = v_property
    LIMIT 500
  ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."houseNumber"), '[]'::jsonb) INTO v_tenants
  FROM (
    SELECT ti.id, ti.full_name AS "fullName", ti.phone, ti.unit_id AS "unitId",
           u.house_number AS "houseNumber", u.unit_type AS "unitType",
           u.monthly_rent AS "monthlyRent", u.deposit AS "deposit",
           (ti.onboarding_completed_at IS NOT NULL) AS "onboarded",
           ti.onboarding_completed_at AS "onboardingCompletedAt",
           ti.created_at AS "createdAt",
           (SELECT COALESCE(jsonb_object_agg(o.step, o.data), '{}'::jsonb)
              FROM public.tenant_onboarding o WHERE o.tenant_id = ti.id) AS "wizard",
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('fullName', h.full_name, 'phone', h.phone) ORDER BY h.created_at), '[]'::jsonb)
              FROM public.tenant_household_members h WHERE h.tenant_id = ti.id) AS "household",
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', e.name, 'relationship', e.relationship, 'phone', e.phone, 'county', e.county) ORDER BY e.created_at), '[]'::jsonb)
              FROM public.tenant_emergency_contacts e WHERE e.tenant_id = ti.id) AS "emergencyContacts",
           public.rent_ledger_for_tenant(ti.id) AS "rentLedger"
    FROM public.tenant_identities ti
    JOIN public.units u ON u.id = ti.unit_id
    WHERE ti.property_id = v_property
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.role, s.username), '[]'::jsonb) INTO v_staff_list
  FROM (
    SELECT s2.id, s2.username, s2.full_name AS "fullName", s2.phone, s2.role,
           s2.is_active AS "isActive",
           COALESCE((NULLIF(p.description,'')::jsonb) -> 'staffPermissions' ->> 'canAllocate', 'true')::boolean AS "canAllocate"
    FROM public.staff_accounts s2
    JOIN public.properties p ON p.id = s2.property_id
    WHERE s2.property_id = v_property
  ) s;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r."createdAt" DESC), '[]'::jsonb) INTO v_requests
  FROM (
    SELECT mr.id, mr.title, mr.description, mr.category, mr.priority, mr.status,
           mr.created_at AS "createdAt", mr.resolved_at AS "resolvedAt",
           u.house_number AS "houseNumber",
           ti.full_name AS "tenantName", ti.phone AS "tenantPhone"
    FROM public.maintenance_requests mr
    JOIN public.units u ON u.id = mr.unit_id
    LEFT JOIN public.tenant_identities ti ON ti.id = mr.tenant_id
    WHERE u.property_id = v_property
  ) r;

  v_settings := NULL;
  BEGIN
    SELECT NULLIF(p.description,'')::jsonb INTO v_settings
    FROM public.properties p WHERE p.id = v_property;
  EXCEPTION WHEN others THEN
    v_settings := NULL;
  END;

  SELECT jsonb_build_object(
    'month', to_char(now(), 'YYYY-MM'),
    'collectedThisMonth', COALESCE((SELECT SUM(pay.amount) FROM public.payments pay
        JOIN public.tenant_identities ti ON ti.id = pay.tenant_id
        WHERE ti.property_id = v_property AND pay.status = 'completed'
          AND pay.paid_at >= date_trunc('month', now())), 0),
    'awaitingCount', COALESCE((SELECT count(*) FROM public.payments pay
        JOIN public.tenant_identities ti ON ti.id = pay.tenant_id
        WHERE ti.property_id = v_property AND pay.confirmation_status = 'awaiting_landlord'), 0),
    'outstanding', COALESCE((SELECT SUM((rent -> 'summary' ->> 'outstanding')::numeric)
        FROM jsonb_array_elements(v_tenants) AS rent), 0),
    'openRequests', COALESCE((SELECT count(*) FROM jsonb_array_elements(v_requests) AS rq
        WHERE rq ->> 'status' NOT IN ('completed','closed')), 0)
  ) INTO v_summary;

  RETURN jsonb_build_object(
    'property', (SELECT jsonb_build_object('id', p.id, 'name', p.name, 'location', p.location)
                 FROM public.properties p WHERE p.id = v_property),
    'settings', v_settings,
    'units', v_units,
    'payments', v_payments,
    'tenants', v_tenants,
    'staff', v_staff_list,
    'requests', v_requests,
    'summary', v_summary
  );
END;
$fn$;

-- ── 11. tenant_session_data — all payment statuses + rent ledger ───────────
CREATE OR REPLACE FUNCTION public.tenant_session_data(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  v_tenant_id uuid;
  v_tenant public.tenant_identities;
  v_unit public.units;
  v_property public.properties;
  v_steps jsonb;
  v_household jsonb;
  v_emergency jsonb;
  v_payments jsonb;
  v_ledger jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  SELECT ts.tenant_id INTO v_tenant_id
  FROM public.tenant_sessions ts
  WHERE ts.token = p_token AND ts.expires_at > now();
  IF v_tenant_id IS NULL THEN RETURN jsonb_build_object('error','Invalid session.'); END IF;

  PERFORM public.touch_session(p_token);

  SELECT * INTO v_tenant FROM public.tenant_identities WHERE id = v_tenant_id;

  SELECT COALESCE(jsonb_object_agg(step, data), '{}'::jsonb) INTO v_steps
  FROM public.tenant_onboarding WHERE tenant_id = v_tenant_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('fullName', full_name, 'phone', phone) ORDER BY created_at), '[]'::jsonb)
    INTO v_household FROM public.tenant_household_members WHERE tenant_id = v_tenant_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'relationship', relationship, 'phone', phone, 'county', county) ORDER BY created_at), '[]'::jsonb)
    INTO v_emergency FROM public.tenant_emergency_contacts WHERE tenant_id = v_tenant_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p."paidAt" DESC), '[]'::jsonb) INTO v_payments
  FROM (
    SELECT id, amount, method, reference, category, status, paid_at AS "paidAt", notes
    FROM public.payments
    WHERE tenant_id = v_tenant_id AND status IN ('completed','pending')
  ) p;

  v_ledger := public.rent_ledger_for_tenant(v_tenant_id);

  SELECT * INTO v_unit FROM public.units WHERE id = v_tenant.unit_id;
  SELECT * INTO v_property FROM public.properties WHERE id = v_tenant.property_id;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'fullName', v_tenant.full_name,
      'phone', v_tenant.phone,
      'unitId', v_tenant.unit_id,
      'onboardingCompleted', v_tenant.onboarding_completed_at IS NOT NULL
    ),
    'unit', CASE WHEN v_unit.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_unit.id, 'houseNumber', v_unit.house_number, 'type', v_unit.unit_type,
      'monthlyRent', v_unit.monthly_rent, 'deposit', v_unit.deposit,
      'bookingDeposit', v_unit.booking_deposit,
      'water', v_unit.utilities ->> 'water',
      'electricity', v_unit.utilities ->> 'electricity'
    ) END,
    'property', CASE WHEN v_property.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_property.id, 'name', v_property.name, 'location', v_property.location
    ) END,
    'steps', v_steps,
    'household', v_household,
    'emergencyContacts', v_emergency,
    'payments', v_payments,
    'rentLedger', v_ledger
  );
END;
$fn$;

-- ── 12. allocate_unit_v2 — confirmation workflow on the two initial payments ──
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

  INSERT INTO public.tenant_identities
    (property_id, unit_id, full_name, phone, provisioned_email, code_hash, code_expires_at, created_by)
  VALUES
    (v_property, p_unit_id, TRIM(p_tenant_name), TRIM(p_tenant_phone), v_email,
     v_code_hash, now() + interval '30 days', v_staff.id)
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

  RETURN jsonb_build_object('tenantId', v_tenant, 'accessCode', v_code);
END;
$fn$;

-- ── 13. grants ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.staff_record_payment(uuid,uuid,numeric,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_payment_action(uuid,uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_request_update(uuid,uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_save_settings(uuid,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_profile(uuid,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_create_request(uuid,request_category,request_priority,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_fetch_requests(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_brightpay_initiate(uuid,numeric,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_brightpay_status(uuid,uuid,text,text) TO anon, authenticated;
