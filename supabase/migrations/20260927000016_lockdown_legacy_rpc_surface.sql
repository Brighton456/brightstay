-- BrightStay · migration 0016 — leftover-surface lockdown after 0015.
-- 1. Drop the obsolete v1 RPCs from migration 0013. All flows now use the
--    token-authenticated staff_*/tenant_* RPCs; the app performs zero direct
--    table reads (verified: no supabase.from() anywhere in src/).
-- 2. Pin search_path on the remaining legacy helpers (advisor WARN 0011).

drop function if exists public.allocate_unit(uuid, uuid, numeric, numeric, numeric);
drop function if exists public.generate_access_code();
drop function if exists public.verify_access_code(character);

alter function public.update_updated_at_column() set search_path = 'public';
alter function public.staff_permission_allows(text, uuid, text) set search_path = 'public';
