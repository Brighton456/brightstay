import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Phone, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MpesaIcon } from "@/components/app/MpesaIcon";
import { toast } from "sonner";
import { formatKES } from "@/lib/format";
import {
  BRIGHTPAY_POLL_INTERVAL_MS,
  BRIGHTPAY_POLL_MAX_MS,
  BrightPayError,
  fetchPaymentStatus,
  initiatePayment,
  type PaymentStatusResult,
} from "@/lib/brightpay";

type Phase = "form" | "sending" | "waiting" | "success" | "failed" | "timeout";

interface PayWithMpesaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  description?: string;
  defaultPhone?: string;
  onSuccess?: (info: { amount: number; reference: string; receipt?: string }) => void;
  onFailed?: () => void;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/[\s+-]/g, "");
  if (digits.length >= 8) return digits.slice(0, digits.length - 4) + "••••";
  return phone;
}

export default function PayWithMpesaDialog({
  open,
  onOpenChange,
  amount,
  description,
  defaultPhone = "",
  onSuccess,
  onFailed,
}: PayWithMpesaDialogProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [receipt, setReceipt] = useState<{ id?: string; reference?: string }>({});

  const checkoutIdRef = useRef<string | null>(null);
  const externalRef = useRef<string>("");
  const aliveRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const stopTimers = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    pollTimerRef.current = null;
    tickTimerRef.current = null;
    aliveRef.current = false;
  };

  useEffect(() => stopTimers, []);

  useEffect(() => {
    if (open) {
      setPhase("form");
      setPhone(defaultPhone);
      setError("");
      setElapsed(0);
      setReceipt({});
      checkoutIdRef.current = null;
      externalRef.current = "";
    }
  }, [open, defaultPhone]);

  const close = () => {
    stopTimers();
    onOpenChange(false);
  };

  const schedulePoll = (checkoutId: string) => {
    if (!aliveRef.current) return;
    if (Date.now() - startedAtRef.current >= BRIGHTPAY_POLL_MAX_MS) {
      setPhase("timeout");
      toast.warning("Payment is still pending on M-Pesa side. Please approve the STK push on your phone.");
      return;
    }
    pollTimerRef.current = setTimeout(async () => {
      if (!aliveRef.current) return;
      try {
        const status: PaymentStatusResult = await fetchPaymentStatus(checkoutId);
        if (!aliveRef.current) return;
        if (status.status === "COMPLETED") {
          stopTimers();
          setReceipt({ id: status.mpesa_receipt, reference: externalRef.current });
          setPhase("success");
          onSuccess?.({
            amount,
            reference: externalRef.current,
            receipt: status.mpesa_receipt,
          });
        } else if (status.status === "FAILED") {
          stopTimers();
          setPhase("failed");
          onFailed?.();
        } else {
          schedulePoll(checkoutId);
        }
      } catch {
        if (!aliveRef.current) return;
        schedulePoll(checkoutId);
      }
    }, BRIGHTPAY_POLL_INTERVAL_MS);
  };

  const beginPolling = (checkoutId: string) => {
    aliveRef.current = true;
    startedAtRef.current = Date.now();
    setElapsed(0);
    tickTimerRef.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)),
      1_000
    );
    schedulePoll(checkoutId);
  };

  const submit = async () => {
    setError("");
    if (!phone.trim()) {
      setError("Enter your M-Pesa phone number.");
      return;
    }
    setPhase("sending");
    try {
      const result = await initiatePayment({ amount, phoneNumber: phone });
      externalRef.current = result.transaction_id || result.checkout_id;
      checkoutIdRef.current = result.checkout_id;
      setPhase("waiting");
      beginPolling(result.checkout_id);
    } catch (err) {
      setPhase("form");
      if (err instanceof BrightPayError) {
        setError(err.message);
        toast.error(err.message);
      } else {
        const msg = "Could not reach BrightPay. Try again.";
        setError(msg);
        toast.error(msg);
      }
    }
  };

  const confirmDone = () => {
    stopTimers();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            {phase === "success" ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Payment successful
              </>
            ) : phase === "failed" || phase === "timeout" ? (
              <>
                <AlertCircle className="h-5 w-5 text-rose-600" /> Payment not completed
              </>
            ) : (
              <>
                <MpesaIcon className="h-5 w-5" /> Pay with M-Pesa
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border bg-muted/50 p-4">
              <div>
                <p className="text-xs text-muted-foreground">{description ?? "Rent payment"}</p>
                <p className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-foreground">
                  {formatKES(amount)}
                </p>
              </div>
              <ShieldCheck className="h-8 w-8 text-brand-600" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                M-Pesa phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07xx xxx xxx"
                  className="h-11 rounded-xl pl-10"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              {error && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">{error}</p>}
            </div>

            <Button onClick={submit} className="h-12 w-full gap-2 rounded-xl">
              <MpesaIcon className="h-5 w-5" /> Send STK push
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              You'll receive a pop-up prompt on your phone to enter your M-Pesa PIN. No card details are stored.
            </p>
          </div>
        )}

        {phase === "sending" && (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
            <p className="mt-4 font-semibold text-foreground">Contacting BrightPay…</p>
            <p className="mt-1 text-sm text-muted-foreground">Initiating M-Pesa STK push for {formatKES(amount)}</p>
          </div>
        )}

        {(phase === "waiting" || phase === "timeout") && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4 text-center">
              {phase === "waiting" ? (
                <span className="relative inline-flex">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <Loader2 className="relative h-12 w-12 animate-spin text-emerald-600" />
                </span>
              ) : (
                <AlertCircle className="h-12 w-12 text-rose-500" />
              )}
              <p className="mt-4 font-semibold text-foreground">
                {phase === "waiting" ? "Waiting for approval…" : "Payment is still pending"}
              </p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Check {maskPhone(phone)} and enter your M-Pesa PIN when prompted.
              </p>
              <p className="mt-3 rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
                Ref {externalRef.current}
              </p>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full gradient-brand transition-all"
                style={{
                  width: `${Math.min(100, (elapsed / (BRIGHTPAY_POLL_MAX_MS / 1000)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Watching for ~{Math.max(0, Math.ceil(BRIGHTPAY_POLL_MAX_MS / 1000 - elapsed))}s ·{" "}
              {phase === "timeout" ? "timed out" : `elapsed ${elapsed}s`}
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={close}>
                <X className="h-4 w-4" /> Close
              </Button>
              {phase === "timeout" && (
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    stopTimers();
                    setPhase("form");
                  }}
                >
                  Try again
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              M-Pesa declined this payment — you may have cancelled the prompt or entered an incorrect PIN.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={close}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={() => setPhase("form")}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {phase === "success" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-2 font-display text-2xl font-semibold text-foreground">{formatKES(amount)}</p>
              <p className="text-xs text-muted-foreground">{description ?? "paid via M-Pesa"}</p>
              {receipt.id && (
                <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 font-mono text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Receipt {receipt.id}
                </p>
              )}
            </div>
            <Button onClick={confirmDone} className="h-12 w-full rounded-xl">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}