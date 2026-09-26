# BrightStay — Tenant Onboarding Review & Completion Report

Date: 2026-09-26 · Supabase project: Brightstay-Supabase (verified via MCP)

## What was already done (before this session)

| Area | State |
|---|---|
| Migrations 1–12 | ✅ Applied live (profiles, properties, units, leases, invoices, payments, RLS hardening) |
| Migration `0013_tenant_allocation_and_access_codes` | ✅ Applied live — `tenant_allocations` + `access_codes` tables, RPCs `allocate_unit`, `generate_access_code`, `verify_access_code` (all SECURITY DEFINER) |
| `src/services/**` | ❌ Skeletons only (threw "implemented by KELVIN") |
| `Auth.tsx` | ❌ Still had tenant email signup tabs |
| Allocation UI, wizard, tenant initial payments | ❌ Missing |
| `agent-chat.md` | Announced lanes but no work landed; board tasks 2–8 open |

## What was completed (this session)

### 1. Auth model pivot (per landlord decision)
Email signups are disabled and anonymous signups enabled → the Supabase session
(role `authenticated`) is now only an **RLS carrier**. All identity lives in DB
tables, following the Brightcaret pattern (`C:/Users/user/Downloads/Brightcaret-04b91a5c`,
`supabase/functions/staff-auth/index.ts`): hashed passwords, failed-attempt lockout,
server-side session tokens, first-login password change.

### 2. Migration 00014 — applied live to Brightstay-Supabase ✅
File: `supabase/migrations/20260926170000_tenant_onboarding_auth_tables.sql`

**Tables**
- `staff_accounts` (username, bcrypt password_hash, role, property_id, lockout, must_change_password)
- `staff_sessions` (12h expiry tokens)
- `tenant_identities` (created at allocation; code_hash, code_used_at, onboarding_completed_at, failed attempts)
- `tenant_access_codes` (plaintext 6-digit registry, PK + regex check; no client grants)
- `tenant_sessions` (one capability token per tenant)
- `tenant_onboarding` (step 1/2/3 jsonb submissions, unique per tenant+step)
- `tenant_household_members`, `tenant_emergency_contacts`
- `payments`: + `category` (rent/deposit/booking/other), `lease_id` now nullable,
  `recorded_by` → `recorded_by_staff` → `staff_accounts`
- `audit_logs`: + `actor_staff_id` (legacy profiles FK dropped)

**Lockdown (RLS review for anonymous-authenticated sessions)**
- All new tables: `revoke all` from anon+authenticated — access only via SECURITY DEFINER RPCs
- Legacy `access_codes` anonymous `UPDATE (qual=true)` hole: policy dropped
- Direct grants on `access_codes`/`tenant_allocations` revoked

**RPCs** (all SECURITY DEFINER, granted to anon+authenticated)
`staff_login`, `staff_session`, `staff_logout`, `staff_change_password`,
`staff_overview`, `staff_dashboard`, `staff_add_unit`, `staff_create_caretaker`,
`staff_set_permission`, `allocate_unit_v2`, `tenant_verify_code`,
`tenant_session_data`, `tenant_save_step`, `tenant_complete`

**Bootstrap**: default property + first landlord `admin / SetMeUp!2026`
(must change password on first login — change it in production).

### 3. Frontend (React/Vite/TS/Tailwind)
- `src/services/staffAuth.ts`, `src/services/tenantPortal.ts` — typed RPC clients; contract shims keep `allocation.ts`/`accessCodes.ts`/`onboarding.ts`/`tenantPayments.ts` alive
- `src/contexts/AppSessionContext.tsx` — anonymous carrier session + staff/tenant table sessions
- `src/contexts/AuthContext.tsx` — rewritten compatibility layer (no signup API)
- Routes: `/auth` (tenant login-only + access-code quiz), `/manager` (staff login), `/manager/change-password`, `/tenant/access` (6-digit entry), `/tenant/onboarding` (3-step wizard), `/app` (tenant dashboard)
- Portal pages rewritten over `staff_overview`: Dashboard, Rooms (allocation dialog with deposit+rent, methods, references → success panel with copyable code; add-unit), Payments ledger, Tenants, Caretakers & permissions, Reports, Rankings, Accounting, Requests
- Tenant pages: Home shows **initial deposit + initial rent** with method/reference/date; Payments, House, Profile rewritten; Requests de-scoped to local drafts

### 4. Verification
- `npx tsc --noEmit` ✅ clean
- `npm run test` ✅ 4/4 (landing, login-only + quiz, /manager, /tenant/access)
- `npm run build` ✅ (pre-existing chunk-size warning only)
- Live DB E2E ✅: `staff_login` → `staff_add_unit` → `allocate_unit_v2` (code issued, deposit M-Pesa + rent Cash recorded with references) → `tenant_verify_code` → 3 × `tenant_save_step` → `tenant_complete` → `tenant_session_data` returns unit, household, emergency contacts and both payments
- Test rows cleaned up afterwards

## Known gaps / next steps
1. Tenant maintenance requests are local-only until a `tenant_create_request` RPC is added.
2. Old email-based flows removed: `Onboarding.tsx` (staff property wizard), `OrgContext`, `lib/api.ts` deleted — portal now runs purely on RPCs.
3. M-Pesa STK payment pages (brightpay) are not wired to the new tenant identities yet.
4. Seeded credentials (`admin / SetMeUp!2026`) should be rotated immediately in production.
5. `npm audit` reports dev-dependency advisories (esbuild/vite) — non-blocking.
