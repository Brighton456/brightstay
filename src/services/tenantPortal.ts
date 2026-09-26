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
}

export async function fetchTenantSession(token: string): Promise<RpcResult<TenantDashboardData>> {
  return rpc<TenantDashboardData>("tenant_session_data", { p_token: token });
}
