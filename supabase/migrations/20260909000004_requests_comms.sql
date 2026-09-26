-- BrightStay · migration 004 — requests, notifications, documents, audit, messages, ratings
-- Requires migrations 001–003.

create type public.request_category as enum ('Plumbing', 'Electrical', 'Structural', 'Household', 'Security', 'Other');
create type public.request_priority as enum ('Low', 'Medium', 'High', 'Urgent');
create type public.request_status as enum ('submitted', 'in_review', 'in_progress', 'completed', 'closed');

-- ---- Maintenance requests ----
create table public.maintenance_requests (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete set null,
  category public.request_category not null default 'Other',
  priority public.request_priority not null default 'Medium',
  title text not null,
  description text,
  photos jsonb not null default '[]'::jsonb,
  status public.request_status not null default 'submitted',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Notifications ----
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'general',
  title text not null,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---- Documents (leases, IDs, receipts) ----
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  name text not null,
  type text not null default 'other',
  url text not null,
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---- Audit trail ----
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Caretakers can write audit lines for landlord review
create or replace function public.log_audit(action text, entity_type text, entity_id uuid default null, details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), action, entity_type, entity_id, details);
end;
$$;

-- ---- Messages (tenant ↔ caretaker/landlord) ----
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  related_type text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_pair on public.messages(sender_id, receiver_id);

-- ---- Tenant ratings (payment reliability) ----
create table public.tenant_ratings (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(3,2) not null check (score between 0 and 5),
  comment text,
  rated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (tenant_id, rated_by)
);

-- ---- RLS: statements for all tables ----
-- assistance: grants will be provided to authenticated below.

alter table public.maintenance_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.messages enable row level security;
alter table public.tenant_ratings enable row level security;

-- maintenance_requests
drop policy if exists "req_select_landlord" on public.maintenance_requests;
create policy "req_select_landlord" on public.maintenance_requests
  for select using (public.is_landlord());

drop policy if exists "req_select_caretaker_own" on public.maintenance_requests;
create policy "req_select_caretaker_own" on public.maintenance_requests
  for select using (
    exists (select 1 from public.units u where u.id = maintenance_requests.unit_id and public.is_property_caretaker(u.property_id))
  );

drop policy if exists "req_select_tenant_own" on public.maintenance_requests;
create policy "req_select_tenant_own" on public.maintenance_requests
  for select using (tenant_id = auth.uid());

drop policy if exists "req_insert_tenant_own" on public.maintenance_requests;
create policy "req_insert_tenant_own" on public.maintenance_requests
  for insert with check (
    tenant_id = auth.uid()
    and exists (
      select 1 from public.leases l
      where l.unit_id = maintenance_requests.unit_id
        and l.tenant_id = auth.uid()
        and l.status = 'active'
    )
  );

drop policy if exists "req_insert_staff" on public.maintenance_requests;
create policy "req_insert_staff" on public.maintenance_requests
  for insert with check (public.is_staff());

drop policy if exists "req_update_staff" on public.maintenance_requests;
create policy "req_update_staff" on public.maintenance_requests
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "req_delete_staff" on public.maintenance_requests;
create policy "req_delete_staff" on public.maintenance_requests
  for delete using (public.is_staff());

-- notifications
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notif_insert_staff" on public.notifications;
create policy "notif_insert_staff" on public.notifications
  for insert with check (public.is_staff());

drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- documents
drop policy if exists "docs_select_own" on public.documents;
create policy "docs_select_own" on public.documents
  for select using (owner_id = auth.uid() or uploaded_by = auth.uid());

drop policy if exists "docs_select_landlord" on public.documents;
create policy "docs_select_landlord" on public.documents
  for select using (public.is_landlord());

drop policy if exists "docs_insert_owner" on public.documents;
create policy "docs_insert_owner" on public.documents
  for insert with check (owner_id = auth.uid() or public.is_staff());

drop policy if exists "docs_delete_owner" on public.documents;
create policy "docs_delete_owner" on public.documents
  for delete using (owner_id = auth.uid() or uploaded_by = auth.uid() or public.is_staff());

-- audit_logs
drop policy if exists "audit_select" on public.audit_logs;
create policy "audit_select" on public.audit_logs
  for select using (public.is_landlord() or actor_id = auth.uid());

drop policy if exists "audit_insert" on public.audit_logs;
create policy "audit_insert" on public.audit_logs
  for insert with check (public.is_staff() and (actor_id = auth.uid() or actor_id is null));

-- messages
drop policy if exists "msg_select_participant" on public.messages;
create policy "msg_select_participant" on public.messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "msg_insert_participant" on public.messages;
create policy "msg_insert_participant" on public.messages
  for insert with check (sender_id = auth.uid() and receiver_id <> auth.uid());

drop policy if exists "msg_update_read" on public.messages;
create policy "msg_update_read" on public.messages
  for update using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- tenant_ratings
drop policy if exists "rating_select_landlord" on public.tenant_ratings;
create policy "rating_select_landlord" on public.tenant_ratings
  for select using (public.is_landlord());

drop policy if exists "rating_select_caretaker_own" on public.tenant_ratings;
create policy "rating_select_caretaker_own" on public.tenant_ratings
  for select using (
    exists (
      select 1 from public.leases l
      join public.units u on u.id = l.unit_id
      where l.tenant_id = tenant_ratings.tenant_id and public.is_property_caretaker(u.property_id)
    )
  );

drop policy if exists "rating_select_tenant_own" on public.tenant_ratings;
create policy "rating_select_tenant_own" on public.tenant_ratings
  for select using (tenant_id = auth.uid());

drop policy if exists "rating_insert_staff" on public.tenant_ratings;
create policy "rating_insert_staff" on public.tenant_ratings
  for insert with check (public.is_staff());

grant select, insert, update, delete on public.maintenance_requests, public.notifications, public.documents, public.audit_logs, public.messages, public.tenant_ratings to authenticated;
grant execute on function public.log_audit to authenticated;