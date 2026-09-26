/**
 * Staff auth — Brightcaret pattern: accounts + sessions live in DB tables,
 * accessed via SECURITY DEFINER RPCs. The Supabase session (anonymous signup)
 * is only the RLS carrier; no email signup, no auth.users identity.
 */

import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: "landlord" | "caretaker";
  propertyId: string | null;
}

export interface StaffLoginResult {
  token?: string;
  staff?: StaffUser;
  mustChangePassword?: boolean;
  error?: string;
}

export interface StaffOverview {
  property?: { id: string; name: string; location: string | null };
  units: StaffUnit[];
  payments: StaffPayment[];
  tenants: StaffTenant[];
  staff: StaffMember[];
  error?: string;
}

export interface StaffUnit {
  id: string;
  houseNumber: string;
  type: string;
  monthlyRent: number;
  deposit: number;
  bookingDeposit: number;
  status: "vacant" | "occupied" | "maintenance";
  sizeM2: number | null;
  water: string | null;
  electricity: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  onboarded: boolean;
}

export interface StaffPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  category: string;
  paidAt: string;
  notes: string | null;
  tenantName: string;
  houseNumber: string;
}

export interface StaffTenant {
  id: string;
  fullName: string;
  phone: string;
  unitId: string;
  houseNumber: string;
  onboarded: boolean;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  role: "landlord" | "caretaker";
  isActive: boolean;
  canAllocate: boolean;
}

export type RpcResult<T> = { data: T | null; error?: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: "Supabase is not configured." };
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  // Every auth RPC returns jsonb with an `error` field on failure.
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    return { data: null, error: String((data as Record<string, unknown>).error) };
  }
  return { data: data as T };
}

export async function staffLogin(username: string, password: string): Promise<StaffLoginResult> {
  const res = await rpc<{ token: string; staff: StaffUser; mustChangePassword: boolean }>("staff_login", {
    p_username: username,
    p_password: password,
  });
  if (res.error || !res.data) return { error: res.error ?? "Could not sign in." };
  return {
    token: res.data.token,
    staff: res.data.staff,
    mustChangePassword: res.data.mustChangePassword,
  };
}

export async function staffSession(token: string): Promise<{ valid: boolean; staff?: StaffUser }> {
  const res = await rpc<{ valid: boolean; staff: StaffUser }>("staff_session", { p_token: token });
  if (res.error || !res.data) return { valid: false };
  return res.data.valid ? { valid: true, staff: res.data.staff } : { valid: false };
}

export async function staffLogout(token: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc("staff_logout", { p_token: token });
}

export async function staffChangePassword(token: string, newPassword: string): Promise<{ error?: string }> {
  const res = await rpc<{ ok: boolean }>("staff_change_password", { p_token: token, p_new_password: newPassword });
  return res.error ? { error: res.error } : {};
}

export async function fetchStaffOverview(token: string): Promise<StaffOverview> {
  const res = await rpc<StaffOverview>("staff_overview", { p_token: token });
  if (res.error || !res.data) {
    return { units: [], payments: [], tenants: [], staff: [], error: res.error ?? "Could not load data." };
  }
  return {
    property: res.data.property,
    units: res.data.units ?? [],
    payments: res.data.payments ?? [],
    tenants: res.data.tenants ?? [],
    staff: res.data.staff ?? [],
  };
}

export interface AllocateUnitInput {
  unitId: string;
  tenantName: string;
  tenantPhone: string;
  deposit: { amount: number; method: string; reference?: string };
  rent: { amount: number; method: string; reference?: string };
}

export interface AllocateResult {
  tenantId: string;
  accessCode: string;
}

export async function allocateUnit(token: string, input: AllocateUnitInput): Promise<RpcResult<AllocateResult>> {
  return rpc<AllocateResult>("allocate_unit_v2", {
    p_token: token,
    p_unit_id: input.unitId,
    p_tenant_name: input.tenantName,
    p_tenant_phone: input.tenantPhone,
    p_deposit_amount: input.deposit.amount,
    p_deposit_method: input.deposit.method,
    p_deposit_reference: input.deposit.reference ?? "",
    p_rent_amount: input.rent.amount,
    p_rent_method: input.rent.method,
    p_rent_reference: input.rent.reference ?? "",
  });
}

export async function staffAddUnit(
  token: string,
  houseNumber: string,
  unitType: string,
  monthlyRent: number,
  deposit: number,
): Promise<RpcResult<{ id: string; houseNumber: string }>> {
  return rpc("staff_add_unit", {
    p_token: token,
    p_house_number: houseNumber,
    p_unit_type: unitType,
    p_monthly_rent: monthlyRent,
    p_deposit: deposit,
  });
}

export async function staffCreateCaretaker(
  token: string,
  username: string,
  fullName: string,
  phone: string,
  password: string,
): Promise<RpcResult<{ id: string; username: string }>> {
  return rpc("staff_create_caretaker", {
    p_token: token,
    p_username: username,
    p_full_name: fullName,
    p_phone: phone,
    p_password: password,
  });
}

export async function staffSetPermission(
  token: string,
  username: string,
  canAllocate: boolean,
): Promise<RpcResult<{ ok: boolean; canAllocate: boolean }>> {
  return rpc("staff_set_permission", { p_token: token, p_username: username, p_can_allocate: canAllocate });
}
