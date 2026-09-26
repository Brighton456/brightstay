# BrightStay — Agent Coordination Contract

Signed append-only coordination channel: `agent-chat.md`. Read this file before any work; re-read before each task.

## Mission
Ship the tenant-onboarding feature set on the existing BrightStay app (React/Vite/TS/Tailwind/shadcn + Supabase):
1. Landlord/caretaker vacant-room allocation that records a traceable **initial deposit + initial rent** (amount, payment method, reference).
2. **6-digit tenant access codes** for new tenants to log in (tenant login page is login-only; NO signup on the tenant side).
3. **3-step onboarding wizard** (personal contacts → status → emergency contacts).
4. Landlord login fixed at **/manager**.
5. Tenant dashboard shows the recorded initial payments.

## Team & Zones
| Agent | Role | Zone (paths) |
|---|---|---|
| **FELIX** | Lead orchestrator | orchestration, channel + AGENTS.md, shared contracts (`src/services/**` signatures), integration seams, final green build, git/deploy |
| **JOSEH** | UI engineer | `src/pages/**`, `src/components/**`, `src/hooks/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, styling/a11y/testids |
| **KELVIN** | Data/backend engineer | `src/lib/**`, `src/integrations/**`, `src/contexts/**`, `src/services/**` (implementation + tests), `supabase/migrations/**`, `supabase/functions/**` |

Freeze zones: do not edit files outside your zone. Need a change elsewhere → post a signed seam in `agent-chat.md` (file:line + diagnosis) and wait for the zone owner.

## Rules
1. `agent-chat.md` is append-only. New entries ONLY, format: `[SIGNATURE] @ YYYY-MM-DDThh:mmZ — text`. Never edit or rewrite existing entries.
2. Per-task loop: ANNOUNCE → ACT (own zone only) → VERIFY (`npm run build`, `npm run test`, `npx tsc --noEmit`) → LOG (signed, with file:line).
3. A task is DONE only after a second agent signs off. Never declare done alone.
4. Keep the tree runnable: build + tests + typecheck must stay green.
5. Conflicting edits → holler in the channel first. Never edit around each other.
6. Secrets live in `.env` only. Never commit `.env` or real keys.
7. Never guess on money or security. Money flows must be recorded server-side with payment method + reference, never clobbered (traceable).
8. Access codes are security-sensitive: 6-digit numeric, staff-generatable only, never logged.

## Baseline (green, recorded 2026-09-26T12:40Z)
- `npm run build` ✓ (vite 5.4.21; 1m 2s; only chunk-size warning, non-blocking)
- `npm run test` ✓ (vitest 3.2.7 run; pass)
- `npx tsc --noEmit` ✓ (clean)

## Service contract (src/services/** — signature source of truth, bodies owned by KELVIN)
- `src/services/allocation.ts` — vacancies + allocate (records deposit+rent, returns access code)
- `src/services/accessCodes.ts` — generate + verify 6-digit codes
- `src/services/onboarding.ts` — 3-step wizard persistence + complete
- `src/services/tenantPayments.ts` — tenant initial-payment records

All are null-client-safe: when `!isSupabaseConfigured` (client.ts) they must not crash the app — return typed empty/error results.