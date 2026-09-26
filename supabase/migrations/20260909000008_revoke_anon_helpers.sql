-- BrightStay · migration 008 — revoke anon from new RLS helper functions
-- Requires migration 006. This environment's default privileges materialize an
-- explicit EXECUTE grant to `anon` on newly created functions; a `revoke from
-- public` does not remove that explicit grant.

revoke execute on function public.is_property_caretaker_for_lease(uuid) from anon;
revoke execute on function public.lease_is_active_for_unit(uuid) from anon;