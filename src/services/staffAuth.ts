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
  settings?: Record<string, unknown>;
  units: StaffUnit[];
  payments: StaffPayment[];
  tenants: StaffTenant[];
  staff: StaffMember[];
  requests: StaffRequest[];
  summary?: StaffSummary;
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
  tenantId?: string | null;
  onboarded: boolean;
}

export interface PaymentConfirmation {
  recordedByName?: string;
  recordedByRole?: string;
  cashHolder?: string; // Cash: staff currently holding the money
  awaitingAction?: string; // "approval" — M-Pesa recorded by caretaker
  approvedBy?: string;
  approvedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  system?: boolean; // BrightPay/system-initiated (auto-confirmed)
  externalReference?: string;
  initiatedAt?: string;
  mpesaReceipt?: string;
  confirmedAt?: string;
  failedAt?: string;
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
  tenantId?: string;
  unitId?: string;
  tenantPhone?: string;
  recordedByStaffId?: string | null;
  recordedBy?: string | null;
  recordedByName?: string | null;
  recordedByRole?: string | null;
  confirmationStatus?: "auto_confirmed" | "awaiting_landlord" | "confirmed";
  confirmation?: PaymentConfirmation;
  createdAt?: string;
}

export interface RentLedgerMonth {
  period: string; // YYYY-MM
  label: string; // "Mar 2026"
  due: number;
  paid: number;
  status: "paid" | "partial" | "unpaid";
}

export interface RentLedgerSummary {
  monthsPaid: number;
  monthsPartial: number;
  monthsUnpaid: number;
  outstanding: number;
  advance: number;
  monthlyRent: number;
}

export interface RentLedger {
  months: RentLedgerMonth[];
  summary: RentLedgerSummary;
}

export interface StaffTenantWizardStep {
  fullNames?: string;
  phone?: string;
  idNumber?: string;
  residents?: { fullName: string; phone: string }[];
  maritalStatus?: string;
  familyMemberCount?: number;
  occupation?: string;
  incomeSource?: string;
  intendedStayMonths?: number;
  contacts?: { name: string; relationship: string; phone: string; county?: string }[];
}

export interface StaffTenant {
  id: string;
  fullName: string;
  phone: string;
  unitId: string;
  houseNumber: string;
  onboarded: boolean;
  createdAt: string;
  unitType?: string;
  monthlyRent?: number;
  deposit?: number;
  onboardingCompletedAt?: string | null;
  wizard?: Record<string, StaffTenantWizardStep>;
  household?: { fullName: string; phone: string }[];
  emergencyContacts?: { name: string; relationship: string; phone: string; county?: string }[];
  rentLedger?: RentLedger | null;
}

export interface StaffRequest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  houseNumber: string;
  tenantName: string | null;
  tenantPhone: string | null;
}

export interface StaffSummary {
  month?: string;
  collectedThisMonth?: number;
  awaitingCount?: number;
  outstanding?: number;
  openRequests?: number;
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

export async function staffSession(token: string): Promise<{ valid: boolean; staff?: StaffUser; mustChangePassword?: boolean }> {
  const res = await rpc<{ valid: boolean; staff: StaffUser; mustChangePassword?: boolean }>("staff_session", {
    p_token: token,
  });
  if (res.error || !res.data) return { valid: false };
  return res.data.valid ? { valid: true, staff: res.data.staff, mustChangePassword: res.data.mustChangePassword } : { valid: false };
}

/** True once the first landlord account exists (drives /manager first-run UI). */
export async function staffHasLandlord(): Promise<boolean> {
  const res = await rpc<boolean>("staff_has_landlord", {});
  // Fail closed: if the probe errors, assume the first-run window is over.
  return res.error || res.data == null ? true : !!res.data;
}

export interface LandlordSignupResult {
  token?: string;
  staff?: StaffUser;
  mustChangePassword?: boolean;
  error?: string;
}

/** First-run landlord self-signup — open only while no landlord account exists. */
export async function staffSignupLandlord(input: {
  username: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<LandlordSignupResult> {
  const res = await rpc<{ token: string; staff: StaffUser; mustChangePassword: boolean }>("staff_signup_landlord", {
    p_username: input.username,
    p_password: input.password,
    p_full_name: input.fullName,
    p_phone: input.phone ?? null,
  });
  if (res.error || !res.data) return { error: res.error ?? "Could not create the landlord account." };
  return {
    token: res.data.token,
    staff: res.data.staff,
    mustChangePassword: res.data.mustChangePassword,
  };
}

/** Landlord registers their apartment (property) during first-run setup. */
export async function staffCreateProperty(
  token: string,
  name: string,
  location?: string,
  description?: string,
): Promise<RpcResult<{ property: { id: string; name: string; location: string | null } }>> {
  return rpc("staff_create_property", {
    p_token: token,
    p_name: name,
    p_location: location ?? null,
    p_description: description ?? null,
  });
}

export async function staffLogout(token: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc("staff_logout", { p_token: token });
}

export async function staffChangePassword(token: string, newPassword: string): Promise<{ error?: string }> {
  const res = await rpc<{ ok: boolean }>("staff_change_password", { p_token: token, p_new_password: newPassword });
  return res.error ? { error: res.error } : {};
}

/**
 * Landlord-only: (re)issue a tenant's username + temporary password.
 * The server forces the tenant to replace it on their next sign-in.
 */
export async function staffSetTenantCredentials(
  token: string,
  input: { tenantId: string; username: string; password: string },
): Promise<RpcResult<{ ok: boolean; username: string; mustChangePassword?: boolean }>> {
  return rpc("staff_set_tenant_credentials", {
    p_token: token,
    p_tenant_id: input.tenantId,
    p_username: input.username,
    p_password: input.password,
  });
}

export async function fetchStaffOverview(token: string): Promise<StaffOverview> {
  const res = await rpc<StaffOverview>("staff_overview", { p_token: token });
  if (res.error || !res.data) {
    return { units: [], payments: [], tenants: [], staff: [], error: res.error ?? "Could not load data." };
  }
  return {
    property: res.data.property,
    settings: res.data.settings ?? undefined,
    units: res.data.units ?? [],
    payments: res.data.payments ?? [],
    tenants: res.data.tenants ?? [],
    staff: res.data.staff ?? [],
    requests: res.data.requests ?? [],
    summary: res.data.summary,
  };
}

export interface RecordPaymentInput {
  tenantId: string;
  amount: number;
  category: string; // rent | deposit | booking | other
  method: string; // M-Pesa | Cash | Bank | Card | Other
  reference?: string;
  notes?: string;
}

/** Staff-recorded payment. Cash/M-Pesa by caretakers → awaiting landlord confirm. */
export async function staffRecordPayment(token: string, input: RecordPaymentInput): Promise<RpcResult<{ paymentId: string }>> {
  return rpc("staff_record_payment", {
    p_token: token,
    p_tenant_id: input.tenantId,
    p_amount: input.amount,
    p_category: input.category,
    p_method: input.method,
    p_reference: input.reference ?? "",
    p_notes: input.notes ?? "",
  });
}

/** Landlord-only: approve (M-Pesa) or receive (cash) an awaiting payment. */
export async function staffPaymentAction(
  token: string,
  paymentId: string,
  action: "approve" | "receive",
): Promise<RpcResult<{ ok: boolean; paymentId: string }>> {
  return rpc("staff_payment_action", { p_token: token, p_payment_id: paymentId, p_action: action });
}

export async function staffRequestUpdate(token: string, requestId: string, status: string): Promise<RpcResult<{ ok: boolean }>> {
  return rpc("staff_request_update", { p_token: token, p_request_id: requestId, p_status: status });
}

export async function staffSaveSettings(
  token: string,
  settings: Record<string, unknown>,
): Promise<RpcResult<{ ok: boolean; settings: Record<string, unknown> }>> {
  return rpc("staff_save_settings", { p_token: token, p_settings: settings });
}

export async function staffUpdateProfile(token: string, fullName: string, phone?: string): Promise<RpcResult<{ ok: boolean }>> {
  return rpc("staff_update_profile", { p_token: token, p_full_name: fullName, p_phone: phone ?? null });
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
