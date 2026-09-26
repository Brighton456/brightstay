# agent-chat — signed append-only coordination channel

Entry format: `[SIGNATURE] @ YYYY-MM-DDThh:mmZ — text`. Append only. Contract: `AGENTS.md`.

[FELIX] @ 2026-09-26T12:40Z — bootstrap: created channel + AGENTS.md coordination contract (TEAM & ZONE TABLE, rules, baseline). Repo is NOT a git repo (git init + remote git@github.com:Brighton456/brightstay.git pending, no commit yet). Working tree verified: src/pages/portal (11 pages), src/pages/tenant (5 pages), src/integrations/supabase/client.ts (env-keyed, nullable client).

[FELIX] @ 2026-09-26T12:40Z — baseline GREEN: npm run build ✓ (vite 5.4.21, 1m 2s, chunk-size warn only); npm run test ✓ (vitest 3.2.7); npx tsc --noEmit ✓ clean. Recorded in AGENTS.md.

## TASK BOARD
| # | task | owner | depends | acceptance |
|---|---|---|---|---|
| 1 | channel + contract + baseline | FELIX | — | done 12:40Z |
| 2 | migration 00013: allocation fields (initial_deposit_amount/method/reference, initial_rent_amount/method/reference, allocated_by, allocated_at, tenant_code, code_used_at) + staff-gated 6-digit code generation | KELVIN | 1 | applies clean; role-gated; codes 6-digit |
| 3 | implement + test src/services/** (allocation, accessCodes, onboarding, tenantPayments) | KELVIN | 1,2 | typed, vitest green, null-client safe |
| 4 | Auth.tsx tenant login-only + access-code entry + landlord link → /manager | JOSEH | 1,3 (contract) | no tenant signup; /manager link |
| 5 | 3-step onboarding wizard (contacts/status/emergency) | JOSEH | 3 (contract) | steps persist via contract; validation per brief |
| 6 | portal Rooms.tsx allocation UI (vacant → record deposit+rent+method, show code) | JOSEH | 3 (contract) | staff-only UI; calls contract |
| 7 | tenant Home.tsx initial-payments display | JOSEH | 3 (contract) | shows deposit + rent |
| 8 | integration: full green verify + signed logs + seam resolution | FELIX | 2-7 | build/test/tsc green |
| 9 | git init + remote + push; Vercel host (decision: deferred) | FELIX | 8 | — |

## LANES — announced 2026-09-26T12:40Z
- **[JOSEH]** — UI: tasks 4,5,6,7. Read AGENTS.md + this file first. Build against src/services/** contract (skeletons created by FELIX, bodies implemented by KELVIN — do not edit service bodies).
- **[KELVIN]** — backend: tasks 2,3. Read AGENTS.md + this file first. You implement + test src/services/**; FELIX owns skeletons.
- Both: verify with `npm run build` / `npm run test` / `npx tsc --noEmit` (workdir C:/My Coding Projects/brightstay), log signed entries here, coordinate seams here — never edit around each other. No git commands, no commits.[FELIX] @ 2026-09-26T12:54Z — contract infra: src/services/** skeletons + NEW src/lib/tenantSession.ts (localStorage session storage, body ownership KELVIN, consumed by JOSEH UI + KELVIN services) so UI+backend build in parallel.
[FELIX] @ 2026-09-26T12:54Z — ROUND 2 SPAWN (first 2 aborted): launching 10 agents now per TASK BOARD 2-9: FELIX-GIT (init+remote+baseline push+Vercel link), KELVIN-MIG (migration 00013 file only), KELVIN-ONB (migration 00014 + onboarding.ts + tenantPayments.ts + tests), KELVIN-SVC (allocation.ts + accessCodes.ts + tenantSession.ts + tests), JOSEH-AUTH (Auth.tsx login-only + code entry + /manager), JOSEH-WIZ (Onboarding.tsx + App.tsx routes), JOSEH-ALLOC (Rooms.tsx + AllocationDialog), JOSEH-HOME (Home.tsx initial payments), FELIX-INT (integrate: wire seams, review+apply migrations 00013+00014, verify green, LOG [FELIX-INT] GREEN), FELIX-DEPLOY (commit+push+deploy ONLY after [FELIX-INT] GREEN entry). Zones per AGENTS.md; no live migration except FELIX-INT after review; no git except FELIX-GIT/DEPLOY; append-only channel.
[BUFFY] @ 2026-09-26T16:30Z — ANNOUNCE: taking over remaining board (tasks 2-8) solo per user direction. Auth model pivot per user: email signups disabled, anonymous signups enabled => Supabase anon session is RLS carrier ONLY. All identity moves to tables (Brightcaret pattern from C:/Users/user/Downloads/Brightcaret-04b91a5c: staff creds hashed in DB, security-definer RPC auth, session tokens, lockout). Plan: migration 00014 (staff_accounts, staff_sessions, tenant_identities, tenant_sessions, payments.category, FK surgery tenant_id -> tenant_identities, drop access_codes 'update=true' hole, RPC suite: staff_login/session/bootstrap/overview/allocate_unit_v2/permissions + tenant_verify_code/save_step/complete/dashboard/payments) + services + Auth/manager/access/wizard/Rooms/Home UI. Contract amendment: accessCodes.generateAccessCode folded into allocateUnit (single source of the code at allocation time); verifyAccessCode kept. Zones: acting as KELVIN+JOSEH+FELIX with user authorization.
[BUFFY] @ 2026-09-26T20:05Z — COMPLETE: migration 0014_table_auth_and_tenant_onboarding applied live on Brightstay-Supabase (staff_accounts/tenant_identities/tenant_access_codes/wizard tables + 14 security-definer RPCs + lockdown revokes incl. dropped access_codes anon-update hole; bootstrap landlord admin/SetMeUp!2026 must-change). Frontend: services staffAuth/tenantPortal (+ contract shims), AppSessionContext (anon carrier), Auth.tsx login-only + quiz, /manager, /tenant/access, /tenant/onboarding 3-step wizard, portal Rooms allocation dialog (deposit+rent+method+ref -> 6-digit code), tenant Home initial payments. Deleted dead email-auth paths (OrgContext, lib/api, Onboarding.tsx, tenantSession). VERIFY: tsc clean, vitest 4/4, build ok, live E2E allocate->verify->wizard->dashboard payments OK. Details in TENANT_ONBOARDING_REVIEW.md. Remaining gaps: tenant request RPC, M-Pesa STK wiring, rotate seeded admin password.
