const BRIGHTPAY_BASE_URL = "https://lqlpgghortuhdxnfqavj.supabase.co/functions/v1";
const BRIGHTPAY_API_KEY = "bp_ep_432c2873f941acd5";

export const BRIGHTPAY_POLL_INTERVAL_MS = 3_000;
export const BRIGHTPAY_POLL_MAX_MS = 120_000;

export type BrightPayStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface InitiatePaymentInput {
  amount: number;
  phoneNumber: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  transaction_id: string;
  checkout_id: string;
}

export interface PaymentStatusResult {
  status: BrightPayStatus;
  amount?: number;
  mpesa_receipt?: string;
  [key: string]: unknown;
}

export class BrightPayError extends Error {
  constructor(
    message: string,
    public code: "network" | "api" | "timeout" | "validation"
  ) {
    super(message);
    this.name = "BrightPayError";
  }
}

export function normalizeMpesaNumber(phone: string): string {
  const digits = phone.replace(/[\s+-]/g, "");
  if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^7\d{8}$/.test(digits)) return `254${digits}`;
  throw new BrightPayError("Enter an M-Pesa number like 0712 345 678 or 2547…", "validation");
}

export function newExternalReference(prefix = "BP"): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rnd}`;
}

async function brightpayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${BRIGHTPAY_BASE_URL}${path}`, {
      ...init,
      headers: {
        "x-api-key": BRIGHTPAY_API_KEY,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new BrightPayError("Network error — check your connection and try again.", "network");
  }
}

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new BrightPayError(`Unexpected response from BrightPay (HTTP ${res.status}).`, "api");
  }
}

export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new BrightPayError("Enter a valid amount greater than zero.", "validation");
  }
  const phoneNumber = normalizeMpesaNumber(input.phoneNumber);
  const res = await brightpayFetch("/endpoint-pay", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(input.amount),
      phone_number: phoneNumber,
      external_reference: newExternalReference(),
    }),
  });
  const data = await readJson<InitiatePaymentResult>(res);
  if (!res.ok || !data?.success || !data.checkout_id) {
    throw new BrightPayError(`BrightPay rejected the payment ${res.ok ? "" : `(HTTP ${res.status})`}. Try again.`, "api");
  }
  return data;
}

export async function fetchPaymentStatus(checkoutId: string): Promise<PaymentStatusResult> {
  const res = await brightpayFetch(`/endpoint-status?checkout_id=${encodeURIComponent(checkoutId)}`);
  const data = await readJson<PaymentStatusResult>(res);
  if (!res.ok) {
    throw new BrightPayError(`Status check failed (HTTP ${res.status}).`, "api");
  }
  return data;
}

export function isFinalStatus(status: BrightPayStatus): boolean {
  return status === "COMPLETED" || status === "FAILED";
}