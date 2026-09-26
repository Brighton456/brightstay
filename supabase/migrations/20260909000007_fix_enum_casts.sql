-- BrightStay · migration 007 — enum-cast fixes in trigger functions
-- Requires migrations 001–006.
-- sync_unit_status() and apply_payment_to_invoice() assign enum literals
-- through CASE, which PostgreSQL resolved to `text` → error 42804 on first
-- fire. Add explicit casts to the target enum types. ACLs are preserved by
-- CREATE OR REPLACE FUNCTION.

create or replace function public.sync_unit_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.units
  set status = case when new.status = 'active' then 'occupied'::public.unit_status else 'vacant'::public.unit_status end
  where id = new.unit_id;
  return new;
end;
$$;

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