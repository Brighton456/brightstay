/**
 * Tenant service — code verification, wizard, dashboard data.
 * All server work happens in SECURITY DEFINER RPCs; the browser only holds
 * an opaque session token. Access codes are never stored client-side.
 */

import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type RpcResult<T> = { data: T | null; error?: string };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: "Supabase is not configured." };
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    return { data: null, error: String((data as Record<string, unknown>).error) };
  }
  return { data: data as T };
}

/* ── Code verification ─────────────────────────────────────────────────── */

export interface VerifyCodeResult {
  token: string;
  /** True while the tenant still holds a password someone else issued. */
  mustChangePassword?: boolean;
  tenant: {
    id: string;
    fullName: string;
    unitId: string;
    onboardingCompleted: boolean;
  };
}

export async function verifyAccessCode(code: string): Promise<RpcResult<VerifyCodeResult>> {
  return rpc<VerifyCodeResult>("tenant_verify_code", { p_code: code });
}

/**
 * Returning-tenant login with username + password (issued by the landlord).
 * Complements the one-time 6-digit access code so tenants can log back in
 * on a new device. Session token works exactly like a code-claimed one.
 */
export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<RpcResult<VerifyCodeResult>> {
  return rpc<VerifyCodeResult>("tenant_login", {
    p_username: username,
    p_password: password,
  });
}

/**
 * Security state of a live tenant session — drives the forced first-login
 * password change. Cheap probe, safe to call on every restore/refresh.
 */
export interface TenantSecurityState {
  valid: boolean;
  mustChangePassword?: boolean;
  username?: string | null;
}

export async function fetchTenantSecurityState(token: string): Promise<RpcResult<TenantSecurityState>> {
  return rpc<TenantSecurityState>("tenant_security_state", { p_token: token });
}

/** The tenant sets their own password (clears the must-change flag server-side). */
export async function changeTenantPassword(token: string, newPassword: string): Promise<{ error?: string }> {
  const res = await rpc<{ ok: boolean }>("tenant_change_password", {
    p_token: token,
    p_new_password: newPassword,
  });
  return res.error ? { error: res.error } : {};
}

/* ── Wizard steps ──────────────────────────────────────────────────────── */

export interface CoResident {
  fullName: string;
  phone: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  county?: string;
}

export interface Step1Data {
  fullNames: string;
  phone: string;
  idNumber?: string;
  residents: CoResident[];
}

export interface Step2Data {
  maritalStatus: "single" | "married" | "prefer-not-to-say";
  familyMemberCount?: number;
  occupation: "employed" | "student" | "graduate" | "other";
  incomeSource: string;
  intendedStayMonths?: number;
}

export interface Step3Data {
  contacts: EmergencyContact[];
}

export type StepData = Step1Data | Step2Data | Step3Data;

export async function saveOnboardingStep(token: string, step: 1 | 2 | 3, data: StepData): Promise<{ error?: string }> {
  const res = await rpc<{ ok: boolean }>("tenant_save_step", { p_token: token, p_step: step, p_data: data });
  return res.error ? { error: res.error } : {};
}

export async function completeOnboarding(token: string): Promise<{ error?: string }> {
  const res = await rpc<{ ok: boolean }>("tenant_complete", { p_token: token });
  return res.error ? { error: res.error } : {};
}

/* ── Dashboard data ────────────────────────────────────────────────────── */

export interface TenantPayment {
  amount: number;
  method: string;
  reference: string | null;
  category: string;
  status: string;
  paidAt: string;
  id?: string;
  notes?: string | null;
}

export interface TenantLedgerMonth {
  period: string; // YYYY-MM
  label: string; // "Mar 2026"
  due: number;
  paid: number;
  status: "paid" | "partial" | "unpaid";
}

export interface TenantRentLedger {
  months: TenantLedgerMonth[];
  summary: {
    monthsPaid: number;
    monthsPartial: number;
    monthsUnpaid: number;
    outstanding: number;
    advance: number;
    monthlyRent: number;
  };
}

export interface TenantDashboardData {
  tenant: {
    id: string;
    fullName: string;
    phone: string;
    unitId: string;
    onboardingCompleted: boolean;
  };
  unit: {
    id: string;
    houseNumber: string;
    type: string;
    monthlyRent: number;
    deposit: number;
    bookingDeposit: number;
    water: string | null;
    electricity: string | null;
  } | null;
  property: { id: string; name: string; location: string | null } | null;
  steps: Record<string, Step1Data & Step2Data & Step3Data>;
  household: CoResident[];
  emergencyContacts: EmergencyContact[];
  payments: TenantPayment[];
  rentLedger?: TenantRentLedger | null;
}

export async function fetchTenantSession(token: string): Promise<RpcResult<TenantDashboardData>> {
  return rpc<TenantDashboardData>("tenant_session_data", { p_token: token });
}

/* ── Maintenance requests ─────────────────────────────────────────────── */

export interface TenantRequest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export async function fetchTenantRequests(token: string): Promise<RpcResult<{ requests: TenantRequest[] }>> {
  return rpc("tenant_fetch_requests", { p_token: token });
}

export async function createTenantRequest(
  token: string,
  input: { category: string; priority: string; title: string; description?: string },
): Promise<RpcResult<{ requestId: string }>> {
  return rpc("tenant_create_request", {
    p_token: token,
    p_category: input.category,
    p_priority: input.priority,
    p_title: input.title,
    p_description: input.description ?? "",
  });
}

/* ── BrightPay (system M-Pesa) — records + status reporting ───────────── */

export async function brightpayInitiate(
  token: string,
  input: { amount: number; phone: string; category: string; externalReference: string },
): Promise<RpcResult<{ paymentId: string; externalReference: string }>> {
  return rpc("tenant_brightpay_initiate", {
    p_token: token,
    p_amount: input.amount,
    p_phone: input.phone,
    p_category: input.category,
    p_external_reference: input.externalReference,
  });
}

export async function brightpayStatus(
  token: string,
  paymentId: string,
  status: "completed" | "failed",
  receipt?: string,
): Promise<RpcResult<{ ok: boolean }>> {
  return rpc("tenant_brightpay_status", {
    p_token: token,
    p_payment_id: paymentId,
    p_status: status,
    p_receipt: receipt ?? "",
  });
}
