-- BrightStay · migration 006 — fix RLS helper exposure + leases↔units recursion
-- Requires migrations 001–005. Idempotent.

-- --------------------------------------------------------------------------
-- 1. Finish hardening ACLs on SECURITY DEFINER functions
--    (005's specific-role revokes were a no-op while PUBLIC execute existed;
--     this removes the PUBLIC grant. Redundant on fresh projects.) 
-- --------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.sync_unit_status() from public;
revoke execute on function public.apply_payment_to_invoice() from public;

revoke execute on function public.is_landlord() from public;
revoke execute on function public.is_caretaker() from public;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_property_caretaker(uuid) from public;
revoke execute on function public.log_audit(text, text, uuid, jsonb) from public;

grant execute on function public.is_landlord() to authenticated;
grant execute on function public.is_caretaker() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_property_caretaker(uuid) to authenticated;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- --------------------------------------------------------------------------
-- 2. Break the leases ↔ units RLS recursion.
--    leases_select_caretaker_own subqueries units (RLS re-evaluated) and
--    units_select_tenant_own subqueries leases, forming an infinite policy
--    cycle. Cross-table lookups now run inside SECURITY DEFINER helpers owned
--    by `postgres` (BYPASSRLS), so no RLS policy is re-entered from the other
--    side of the relationship.
-- --------------------------------------------------------------------------
create or replace function public.is_property_caretaker_for_lease(p_lease uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.units u
    join public.leases l on l.unit_id = u.id
    where l.id = p_lease
      and public.is_property_caretaker(u.property_id)
  );
$$;

create or replace function public.lease_is_active_for_unit(p_unit uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.leases
    where unit_id = p_unit
      and tenant_id = auth.uid()
      and status = 'active'
  );
$$;

revoke execute on function public.is_property_caretaker_for_lease(uuid) from public;
revoke execute on function public.lease_is_active_for_unit(uuid) from public;
-- this environment's default privileges explicitly grant anon on new functions
revoke execute on function public.is_property_caretaker_for_lease(uuid) from anon;
revoke execute on function public.lease_is_active_for_unit(uuid) from anon;
grant execute on function public.is_property_caretaker_for_lease(uuid) to authenticated;
grant execute on function public.lease_is_active_for_unit(uuid) to authenticated;

drop policy if exists "leases_select_caretaker_own" on public.leases;
create policy "leases_select_caretaker_own" on public.leases
  for select using (public.is_property_caretaker_for_lease(id));

drop policy if exists "units_select_tenant_own" on public.units;
create policy "units_select_tenant_own" on public.units
  for select using (public.lease_is_active_for_unit(id));