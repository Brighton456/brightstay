-- BrightStay · migration 003 — finance: invoices, payments, expenses, ledger
-- Requires migrations 001–002.

create type public.invoice_status as enum ('unpaid', 'partial', 'paid', 'overdue');
create type public.payment_method as enum ('M-Pesa', 'Cash', 'Bank', 'Card', 'Other');
create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded');

-- ---- Invoices (monthly rent bills) ----
create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  due_date date not null,
  status public.invoice_status not null default 'unpaid',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Payments ----
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  method public.payment_method not null default 'M-Pesa',
  status public.payment_status not null default 'completed',
  reference text,
  receipt_url text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_tenant on public.payments(tenant_id);
create index if not exists idx_payments_lease on public.payments(lease_id);
create index if not exists idx_invoices_lease on public.invoices(lease_id);

-- Mark an invoice paid/partial/overdue once a payment lands
create or replace function public.apply_payment_to_invoice()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  inv public.invoices;
  paid_total numeric;
begin
  if new.invoice_id is not null then
    select * into inv from public.invoices where id = new.invoice_id;
    if found and new.status = 'completed' then
      select coalesce(sum(amount), 0) into paid_total
      from public.payments
      where invoice_id = new.invoice_id and status = 'completed';

      update public.invoices
      set status = case
        when paid_total >= inv.amount_due then 'paid'::public.invoice_status
        when paid_total > 0 then 'partial'::public.invoice_status
        else 'unpaid'::public.invoice_status
      end
      where id = new.invoice_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_apply_invoice on public.payments;
create trigger payments_apply_invoice
  after insert or update of status, amount on public.payments
  for each row execute function public.apply_payment_to_invoice();

-- ---- Expenses (landlord side) ----
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references public.properties(id) on delete cascade,
  category text not null default 'Misc',
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  incurred_at date not null default current_date,
  entered_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---- RLS: invoices ----
alter table public.invoices enable row level security;

drop policy if exists "invoices_select_landlord" on public.invoices;
create policy "invoices_select_landlord" on public.invoices
  for select using (public.is_landlord());

drop policy if exists "invoices_select_caretaker_own" on public.invoices;
create policy "invoices_select_caretaker_own" on public.invoices
  for select using (
    exists (
      select 1 from public.leases l
      join public.units u on u.id = l.unit_id
      where l.id = invoices.lease_id and public.is_property_caretaker(u.property_id)
    )
  );

drop policy if exists "invoices_select_tenant_own" on public.invoices;
create policy "invoices_select_tenant_own" on public.invoices
  for select using (
    exists (select 1 from public.leases l where l.id = invoices.lease_id and l.tenant_id = auth.uid())
  );

drop policy if exists "invoices_insert_staff" on public.invoices;
create policy "invoices_insert_staff" on public.invoices
  for insert with check (public.is_staff());

drop policy if exists "invoices_update_staff" on public.invoices;
create policy "invoices_update_staff" on public.invoices
  for update using (public.is_staff()) with check (public.is_staff());

-- ---- RLS: payments ----
alter table public.payments enable row level security;

drop policy if exists "payments_select_landlord" on public.payments;
create policy "payments_select_landlord" on public.payments
  for select using (public.is_landlord());

drop policy if exists "payments_select_caretaker_own" on public.payments;
create policy "payments_select_caretaker_own" on public.payments
  for select using (
    exists (
      select 1 from public.leases l
      join public.units u on u.id = l.unit_id
      where l.id = payments.lease_id and public.is_property_caretaker(u.property_id)
    )
  );

drop policy if exists "payments_select_tenant_own" on public.payments;
create policy "payments_select_tenant_own" on public.payments
  for select using (tenant_id = auth.uid());

drop policy if exists "payments_insert_staff" on public.payments;
create policy "payments_insert_staff" on public.payments
  for insert with check (public.is_staff());

drop policy if exists "payments_update_staff" on public.payments;
create policy "payments_update_staff" on public.payments
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "payments_delete_staff" on public.payments;
create policy "payments_delete_staff" on public.payments
  for delete using (public.is_staff());

-- ---- RLS: expenses ----
alter table public.expenses enable row level security;

drop policy if exists "expenses_select_landlord" on public.expenses;
create policy "expenses_select_landlord" on public.expenses
  for select using (public.is_landlord());

drop policy if exists "expenses_select_caretaker_own" on public.expenses;
create policy "expenses_select_caretaker_own" on public.expenses
  for select using (public.is_property_caretaker(property_id));

drop policy if exists "expenses_insert_landlord" on public.expenses;
create policy "expenses_insert_landlord" on public.expenses
  for insert with check (public.is_landlord());

drop policy if exists "expenses_update_landlord" on public.expenses;
create policy "expenses_update_landlord" on public.expenses
  for update using (public.is_landlord()) with check (public.is_landlord());

drop policy if exists "expenses_delete_landlord" on public.expenses;
create policy "expenses_delete_landlord" on public.expenses
  for delete using (public.is_landlord());

grant select, insert, update, delete on public.invoices, public.payments, public.expenses to authenticated;