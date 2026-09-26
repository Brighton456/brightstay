/**
 * Legacy service stubs kept for the AGENTS.md contract — the real
 * implementations now live in staffAuth.ts and tenantPortal.ts, following
 * the table-based auth model. These re-exports preserve the documented
 * module names from the coordination contract.
 */

export { verifyAccessCode, completeOnboarding } from "./tenantPortal";
export { allocateUnit } from "./staffAuth";
