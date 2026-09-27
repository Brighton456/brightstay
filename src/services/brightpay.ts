/**
 * BrightPay M-Pesa integration (frontend-only, per provider spec).
 *
 *  1. POST  /endpoint-pay            { amount, phone_number, external_reference }
 *     → { success, transaction_id, checkout_id }
 *  2. GET   /endpoint-status?checkout_id=…   (poll every 3s, max ~2 min)
 *     → { status: "PENDING" | "COMPLETED" | "FAILED", mpesa_receipt, … }
 *
 * A unique external_reference is generated per transaction. All network
 * failures are surfaced as typed results — never thrown — so the UI can
 * always show a recoverable error.
 */

const PAY_ENDPOINT =
  "https://lqlpgghortuhdxnfqavj.supabase.co/functions/v1/endpoint-pay";
const STATUS_ENDPOINT =
  "https://lqlpgghortuhdxnfqavj.supabase.co/functions/v1/endpoint-status";

/** Key comes from .env (VITE_BRIGHTPAY_API_KEY) with the shipped fallback. */
const API_KEY: string =
  (import.meta.env?.VITE_BRIGHTPAY_API_KEY as string | undefined) ??
  "bp_ep_7163e9d80c2560cd";

export const PAYMENT_POLL_INTERVAL_MS = 3_000;
export const PAYMENT_POLL_MAX_MS = 120_000;

export interface BrightPayInitiation {
  ok: boolean;
  error?: string;
  transactionId?: string;
  checkoutId?: string;
  externalReference?: string;
}

export interface BrightPayStatusSnapshot {
  status: "PENDING" | "COMPLETED" | "FAILED" | "UNKNOWN";
  amount?: number;
  mpesaReceipt?: string | null;
  raw?: unknown;
}

export type BrightPayOutcome =
  | { kind: "completed"; receipt?: string | null; externalReference: string }
  | { kind: "failed"; reason?: string; externalReference: string }
  | { kind: "timeout"; externalReference: string }
  | { kind: "error"; error: string; externalReference: string };

/** M-Pesa safaricom number: 07…, 01… or 2547…/2541… (spaces/+ tolerated). */
export function normalizeMpesaPhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (/^(0(7|1)\d{8})$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^(254(7|1)\d{8})$/.test(digits)) return digits;
  return null;
}

/** Unique per-transaction tracking id (never reused). */
export function generateExternalReference(): string {
  const rand =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      : Math.random().toString(16).slice(2, 14);
  return `BS-${Date.now().toString(36)}-${rand}`.toUpperCase();
}

function friendlyNetworkError(status: number, body: string): string {
  if (status === 401 || status === 403) return "Payment service rejected the API key.";
  if (status === 429) return "Payment service is busy — try again in a moment.";
  if (status >= 500) return "Payment service is temporarily unavailable.";
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? `Payment request failed (${status}).`;
  } catch {
    return body ? `Payment request failed (${status}).` : `Payment request failed (${status}).`;
  }
}

/** STEP 1 — initiate an STK push to the tenant's phone. */
export async function initiatePayment(input: {
  amount: number;
  /** Local format (07…) or international (2547…). Normalized to 254…. */
  phone: string;
  externalReference?: string;
}): Promise<BrightPayInitiation> {
  const externalReference = input.externalReference ?? generateExternalReference();

  if (!Number.isFinite(input.amount) || input.amount < 1) {
    return { ok: false, error: "Enter an amount of at least KES 1.", externalReference };
  }
  const phone = normalizeMpesaPhone(input.phone);
  if (!phone) {
    return {
      ok: false,
      error: "Enter a valid Safaricom number — 07…, 01… or 2547….",
      externalReference,
    };
  }

  try {
    const res = await fetch(PAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        amount: Math.round(input.amount),
        phone_number: phone,
        external_reference: externalReference,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: friendlyNetworkError(res.status, text), externalReference };
    }
    let parsed: { success?: boolean; transaction_id?: string; checkout_id?: string; error?: string; message?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "Payment service returned an unreadable response.", externalReference };
    }
    if (!parsed.success || !parsed.checkout_id) {
      return {
        ok: false,
        error: parsed.error ?? parsed.message ?? "Could not start the M-Pesa request.",
        externalReference,
      };
    }
    return {
      ok: true,
      transactionId: parsed.transaction_id,
      checkoutId: parsed.checkout_id,
      externalReference,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `Network error: ${err.message}` : "Network error contacting the payment service.",
      externalReference,
    };
  }
}

/** STEP 2 — single status probe. */
export async function checkStatus(checkoutId: string): Promise<BrightPayStatusSnapshot> {
  try {
    const res = await fetch(`${STATUS_ENDPOINT}?checkout_id=${encodeURIComponent(checkoutId)}`, {
      headers: { "x-api-key": API_KEY },
    });
    const text = await res.text();
    if (!res.ok) return { status: "UNKNOWN", raw: friendlyNetworkError(res.status, text) };
    const parsed = JSON.parse(text) as {
      status?: string;
      amount?: number;
      mpesa_receipt?: string | null;
    };
    const status = (parsed.status ?? "").toUpperCase();
    return {
      status: status === "COMPLETED" || status === "FAILED" || status === "PENDING" ? status : "UNKNOWN",
      amount: parsed.amount,
      mpesaReceipt: parsed.mpesa_receipt ?? null,
      raw: parsed,
    };
  } catch {
    return { status: "UNKNOWN" };
  }
}

/**
 * STEP 2 loop — polls every 3s until COMPLETED/FAILED, ~2min cap.
 * `onTick` fires after each probe so the UI can show elapsed time.
 * Pass an AbortSignal to cancel (dialog closed).
 */
export async function pollPaymentStatus(
  checkoutId: string,
  externalReference: string,
  opts?: { intervalMs?: number; maxMs?: number; signal?: AbortSignal; onTick?: (elapsedMs: number) => void },
): Promise<BrightPayOutcome> {
  const intervalMs = opts?.intervalMs ?? PAYMENT_POLL_INTERVAL_MS;
  const maxMs = opts?.maxMs ?? PAYMENT_POLL_MAX_MS;
  const started = Date.now();

  let unknownStreak = 0;
  while (Date.now() - started < maxMs) {
    if (opts?.signal?.aborted) return { kind: "timeout", externalReference };
    if (opts?.onTick) opts.onTick(Date.now() - started);

    const snap = await checkStatus(checkoutId);
    if (snap.status === "COMPLETED") {
      return { kind: "completed", receipt: snap.mpesaReceipt, externalReference };
    }
    if (snap.status === "FAILED") {
      return {
        kind: "failed",
        reason: typeof snap.raw === "object" && snap.raw && "reason" in snap.raw
          ? String((snap.raw as { reason?: string }).reason)
          : undefined,
        externalReference,
      };
    }
    // PENDING or transient network hiccup — give the service a few strikes.
    unknownStreak = snap.status === "UNKNOWN" ? unknownStreak + 1 : 0;
    if (unknownStreak >= 8) {
      return { kind: "error", error: "Lost contact with the payment service. Check the payment later from your receipts.", externalReference };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { kind: "timeout", externalReference };
}
