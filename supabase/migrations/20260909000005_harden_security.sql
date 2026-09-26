-- BrightStay · migration 005 — security hardening + FK index coverage
-- Requires migrations 001–004.
-- NOTE: revoking EXECUTE FROM a specific role is a no-op while a PUBLIC grant
-- exists; we must revoke FROM PUBLIC, then re-grant narrowly (see 006).

-- --------------------------------------------------------------------------
-- 1. Harden SECURITY DEFINER exposure (Supabase lint 0028 / 0029)
-- --------------------------------------------------------------------------
-- Remove the blanket PUBLIC/anon/authenticated EXECUTE, then re-grant below.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.sync_unit_status() from public;
revoke execute on function public.apply_payment_to_invoice() from public;

revoke execute on function public.is_landlord() from public;
revoke execute on function public.is_caretaker() from public;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_property_caretaker(uuid) from public;
revoke execute on function public.log_audit(text, text, uuid, jsonb) from public;

-- Role predicates are used by RLS policies; `authenticated` keeps EXECUTE.
-- `anon` has no table grants; removing it here only closes the RPC route.
-- `supabase_auth_admin` may need the signup trigger when GoTrue inserts users.
grant execute on function public.is_landlord() to authenticated;
grant execute on function public.is_caretaker() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_property_caretaker(uuid) to authenticated;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- --------------------------------------------------------------------------
-- 2. Covering indexes for unindexed foreign keys (Supabase lint 0001)
-- --------------------------------------------------------------------------

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);

create index if not exists idx_documents_owner on public.documents(owner_id);
create index if not exists idx_documents_lease on public.documents(lease_id);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);

create index if not exists idx_expenses_property on public.expenses(property_id);
create index if not exists idx_expenses_entered_by on public.expenses(entered_by);

create index if not exists idx_reqs_unit on public.maintenance_requests(unit_id);
create index if not exists idx_reqs_tenant on public.maintenance_requests(tenant_id);
create index if not exists idx_reqs_assigned_to on public.maintenance_requests(assigned_to);
create index if not exists idx_reqs_created_by on public.maintenance_requests(created_by);

create index if not exists idx_messages_receiver on public.messages(receiver_id);

create index if not exists idx_notifications_user on public.notifications(user_id);

create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_unit on public.payments(unit_id);
create index if not exists idx_payments_recorded_by on public.payments(recorded_by);

create index if not exists idx_properties_caretaker on public.properties(caretaker_id);
create index if not exists idx_properties_created_by on public.properties(created_by);

create index if not exists idx_ratings_rated_by on public.tenant_ratings(rated_by);