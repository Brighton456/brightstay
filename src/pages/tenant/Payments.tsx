import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download, Smartphone, Wallet, Hash, Receipt, ShieldCheck, Loader2,
  CheckCircle2, XCircle, Clock, TriangleAlert, Phone, ChevronRight,
} from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import {
  fetchTenantSession, brightpayInitiate, brightpayStatus,
  type TenantDashboardData, type TenantLedgerMonth,
} from "@/services/tenantPortal";
import {
  initiatePayment, pollPaymentStatus, generateExternalReference,
  type BrightPayOutcome,
} from "@/services/brightpay";
import { PaymentStatus } from "@/components/app/StatusBadge";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatKES, formatDate } from "@/lib/format";
import { exportTableCsv, exportTablePdf } from "@/lib/exports";

const MONTH_CHIP: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  unpaid: "bg-rose-100 text-rose-700",
};

export default function TenantPayments() {
  const { session, refreshTenantSession } = useAppSession();
  const token = session?.kind === "tenant" ? session.token : null;
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  const load = async () => {
    if (!token) return;
    const res = await fetchTenantSession(token);
    if (res.data) setData(res.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const payments = data?.payments ?? [];
  const ledger = data?.rentLedger ?? null;
  const unit = data?.unit;
  const summary = ledger?.summary;
  const outstanding = summary?.outstanding ?? 0;

  const statementCsv = () => {
    if (!data) return;
    exportTableCsv({
      rows: [
        ["BrightStay statement", data.property?.name ?? "", `House ${unit?.houseNumber ?? ""}`, formatDate(new Date().toISOString())],
        [],
        ["Date", "Type", "Amount (KES)", "Method", "Reference", "Status"],
        ...payments.map((p) => [formatDate(p.paidAt), p.category, p.amount, p.method, p.reference ?? "", p.status]),
        [],
        ["Months paid", summary?.monthsPaid ?? 0, "Outstanding", outstanding, "Advance", summary?.advance ?? 0],
      ],
      filename: `BrightStay-statement-${(data.tenant.fullName || "tenant").replace(/\s+/g, "-")}.csv`,
    });
    toast.success("Statement downloaded (Excel/CSV)");
  };

  const statementPdf = () => {
    if (!data) return;
    exportTablePdf({
      title: "Tenant statement",
      name: data.tenant.fullName,
      subtitle: `${data.property?.name ?? "BrightStay"} · House ${unit?.houseNumber ?? "—"} · ${formatDate(new Date().toISOString())}`,
      head: ["Month", "Due", "Paid", "Status"],
      body: (ledger?.months ?? []).map((m) => [m.label, formatKES(m.due), formatKES(m.paid), m.status]),
      filename: `BrightStay-statement-${(data.tenant.fullName || "tenant").replace(/\s+/g, "-")}.pdf`,
      totalsLine: `Months paid: ${summary?.monthsPaid ?? 0} · Outstanding: ${formatKES(outstanding)} · Advance: ${formatKES(summary?.advance ?? 0)}`,
    });
    toast.success("Statement PDF downloaded");
  };

  const categoryLabel = (c: string) =>
    c === "deposit" ? "Initial deposit" : c === "rent" ? "Rent" : c === "booking" ? "Booking fee" : "Other";

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Payments</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight text-foreground">Rent & receipts</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl" onClick={statementCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl" onClick={statementPdf}>
            <Download className="h-3.5 w-3.5" /> Statement PDF
          </Button>
        </div>
      </div>

      {/* Rent status — months paid, due now */}
      <div className="rounded-3xl border bg-gradient-to-br from-brand-50/70 via-card to-card p-5 shadow-card" data-testid="rent-ledger">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Rent tracker</p>
            <p className="mt-1 font-display text-xl font-semibold text-foreground">
              {summary ? `${summary.monthsPaid} month${summary.monthsPaid === 1 ? "" : "s"} paid` : "No rent history yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {unit ? `${unit.type} · ${formatKES(unit.monthlyRent)}/month` : ""}
              {summary && summary.advance > 0 ? ` · ${formatKES(summary.advance)} paid in advance` : ""}
            </p>
          </div>
          {outstanding > 0 ? (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Outstanding</p>
              <p className="font-display text-2xl font-semibold text-rose-600">{formatKES(outstanding)}</p>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> All clear
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(ledger?.months ?? []).slice().reverse().map((m: TenantLedgerMonth) => (
            <span key={m.period} title={`${m.label}: due ${formatKES(m.due)}, paid ${formatKES(m.paid)}`} className={cn("rounded-lg px-2.5 py-1.5 text-[11px] font-bold", MONTH_CHIP[m.status])}>
              {m.label}
            </span>
          ))}
          {(!ledger || ledger.months.length === 0) && (
            <p className="text-xs text-muted-foreground">Your rent months will appear here once payments are recorded.</p>
          )}
        </div>

        <Button onClick={() => setPayOpen(true)} className="mt-4 h-12 w-full gap-2 rounded-xl" data-testid="pay-rent">
          <Smartphone className="h-4 w-4" /> Pay rent with BrightPay (M-Pesa)
        </Button>
      </div>

      {/* Receipts */}
      <div className="space-y-3">
        <SectionHeading eyebrow="Receipts" title="Payments on your account" />
        {payments.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {payments.map((p, i) => (
              <div key={p.id ?? i} className="flex items-center gap-3.5 rounded-2xl border bg-card p-4 shadow-card">
                <span
                  className={
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " +
                    (p.method === "M-Pesa" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500")
                  }
                >
                  {p.method === "M-Pesa" ? <Smartphone className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{formatKES(p.amount)}</p>
                    <PaymentStatus status={p.status === "completed" ? "completed" : p.status === "failed" ? "failed" : "pending"} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {categoryLabel(p.category)} · {p.method}
                    {p.paidAt ? ` · ${formatDate(p.paidAt)}` : ""}
                  </p>
                  {p.reference && (
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Hash className="h-3 w-3" /> {p.reference}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            <Receipt className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No payments recorded yet — your caretaker's entries and BrightPay payments will appear here.
          </p>
        )}
      </div>

      {/* BrightPay STK flow */}
      <BrightPaySheet
        open={payOpen}
        onOpenChange={setPayOpen}
        defaultPhone={data?.tenant?.phone ?? ""}
        monthlyRent={unit?.monthlyRent ?? 0}
        outstanding={outstanding}
        token={token}
        onSettled={async () => {
          await load();
          void refreshTenantSession();
        }}
      />
    </div>
  );
}

/* ── BrightPay sheet: initiate → STK push → poll every 3s ─────────────────── */

type FlowState = "form" | "pushing" | "polling" | "success" | "failed";

function BrightPaySheet({
  open,
  onOpenChange,
  defaultPhone,
  monthlyRent,
  outstanding,
  token,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultPhone: string;
  monthlyRent: number;
  outstanding: number;
  token: string | null;
  onSettled: () => void | Promise<void>;
}) {
  const [state, setState] = useState<FlowState>("form");
  const [amount, setAmount] = useState(String(outstanding > 0 ? outstanding : monthlyRent || ""));
  const [phone, setPhone] = useState(defaultPhone);
  const [category, setCategory] = useState("rent");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Reset the flow whenever the sheet opens fresh.
  useEffect(() => {
    if (open) {
      setState("form");
      setError(null);
      setElapsed(0);
      setAmount(String(outstanding > 0 ? outstanding : monthlyRent || ""));
      setPhone(defaultPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Abort any in-flight poll when the sheet closes or unmounts.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [open]);

  const start = async () => {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 1) return setError("Enter an amount of at least KES 1.");
    if (!token) return setError("Your session expired — sign in again.");

    const externalReference = generateExternalReference();

    // 1. Record the intent server-side first (traceable even if the STK fails).
    const rec = await brightpayInitiate(token, {
      amount: parsed,
      phone,
      category,
      externalReference,
    });
    if (rec.error || !rec.data) {
      setError(rec.error ?? "Could not start the payment.");
      return;
    }
    const paymentId = rec.data.paymentId;

    // 2. Fire the STK push via BrightPay.
    setState("pushing");
    const init = await initiatePayment({ amount: parsed, phone, externalReference });
    if (!init.ok || !init.checkoutId) {
      setState("form");
      setError(init.error ?? "Could not reach BrightPay. No money has left your phone.");
      return;
    }

    // 3. Poll every 3s up to ~2 minutes.
    setState("polling");
    const controller = new AbortController();
    abortRef.current = controller;
    const outcome: BrightPayOutcome = await pollPaymentStatus(init.checkoutId, externalReference, {
      signal: controller.signal,
      onTick: (ms) => setElapsed(Math.round(ms / 1000)),
    });

    if (outcome.kind === "completed") {
      await brightpayStatus(token, paymentId, "completed", outcome.receipt ?? undefined);
      setState("success");
      toast.success("Payment confirmed — receipt saved to your account");
      await onSettled();
    } else if (outcome.kind === "failed") {
      await brightpayStatus(token, paymentId, "failed");
      setState("failed");
      setError(outcome.reason ?? "The M-Pesa request failed or was cancelled.");
      toast.error("Payment did not go through");
    } else if (outcome.kind === "timeout") {
      setState("form");
      setError("We did not get a confirmation in time. If you entered your PIN, the receipt will appear in your payments shortly — do not pay twice.");
    } else {
      setState("form");
      setError(outcome.error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl sm:max-w-lg">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-brand-600" /> Pay with BrightPay
          </SheetTitle>
        </SheetHeader>

        {state === "form" && (
          <div className="space-y-4 px-4 pb-6">
            {outstanding > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                You have {formatKES(outstanding)} outstanding rent. Pay any amount you choose — it is credited to your
                oldest unpaid month first.
              </p>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Amount (KES)</label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 rounded-xl text-base" placeholder="e.g. 12000" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">M-Pesa number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl pl-10" placeholder="07XX or 2547XX…" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">What is this payment for?</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="booking">Booking fee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>
            )}
            <Button className="h-12 w-full rounded-xl" onClick={start}>
              <Smartphone className="h-4 w-4" /> Send STK push to my phone
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              You will enter your M-Pesa PIN on your phone. System payments confirm automatically on the landlord's records.
            </p>
          </div>
        )}

        {(state === "pushing" || state === "polling") && (
          <div className="px-4 pb-8 pt-2 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" />
            <p className="mt-4 font-display text-lg font-semibold text-foreground">Check your phone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your M-Pesa PIN to complete {amount ? formatKES(Number(amount)) : "the payment"}.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Waiting… {elapsed}s / 120s
            </p>
            <Button variant="outline" className="mt-5 w-full rounded-xl" onClick={() => onOpenChange(false)}>
              Close (payment continues safely)
            </Button>
          </div>
        )}

        {state === "success" && (
          <div className="px-4 pb-8 pt-2 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 font-display text-lg font-semibold text-foreground">Payment received</p>
            <p className="mt-1 text-sm text-muted-foreground">Your receipt is saved below with the M-Pesa code.</p>
            <Button className="mt-5 w-full rounded-xl" onClick={() => onOpenChange(false)}>
              <ChevronRight className="h-4 w-4" /> Done
            </Button>
          </div>
        )}

        {state === "failed" && (
          <div className="px-4 pb-8 pt-2 text-center">
            <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            <p className="mt-3 font-display text-lg font-semibold text-foreground">Payment failed</p>
            {error && <p className="mt-1 text-sm text-muted-foreground">{error}</p>}
            <Button variant="outline" className="mt-5 w-full rounded-xl" onClick={() => setState("form")}>
              Try again
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
