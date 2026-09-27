import { useState } from "react";
import {
  Download, Search, Landmark, Banknote, Smartphone, Wallet, CircleEllipsis,
  ShieldCheck, HandCoins, FileSpreadsheet, FileDown, ReceiptText, UserRound, Hash, CalendarDays,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffData } from "@/hooks/useStaffData";
import { staffPaymentAction, staffRecordPayment, type StaffPayment } from "@/services/staffAuth";
import { PaymentStatus } from "@/components/app/StatusBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatKES, formatDate } from "@/lib/format";
import { exportPaymentsCsv, exportPaymentsPdf } from "@/lib/exports";

const METHOD_ICON: Record<string, typeof Wallet> = {
  "M-Pesa": Smartphone,
  Cash: Banknote,
  Bank: Landmark,
  Card: Wallet,
  Other: CircleEllipsis,
};

const CATEGORY_LABEL: Record<string, string> = {
  deposit: "Deposit",
  rent: "Rent",
  booking: "Booking",
  other: "Other",
};

const CONF_LABEL: Record<string, { label: string; tone: "success" | "warning" | "info" }> = {
  auto_confirmed: { label: "System-confirmed", tone: "info" },
  awaiting_landlord: { label: "Awaiting you", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
};

export default function PortalPayments() {
  const { data, loading, token, refresh } = useStaffData();
  const { role } = useAuth();
  const isLandlord = role === "landlord";
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<StaffPayment | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading || !data) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  const payments = data.payments;
  const awaiting = payments.filter((p) => p.confirmationStatus === "awaiting_landlord");

  const filtered = payments.filter((p) => {
    const q = query.toLowerCase();
    const matchQ =
      p.tenantName.toLowerCase().includes(q) ||
      (p.reference ?? "").toLowerCase().includes(q) ||
      p.houseNumber.toLowerCase().includes(q);
    const confOk =
      statusFilter === "all" ||
      (statusFilter === "awaiting" && p.confirmationStatus === "awaiting_landlord") ||
      (statusFilter === "confirmed" && p.confirmationStatus === "confirmed") ||
      (statusFilter === "system" && p.confirmationStatus === "auto_confirmed") ||
      (statusFilter === "pending" && p.status === "pending");
    return (
      matchQ &&
      (method === "all" || p.method === method) &&
      (category === "all" || p.category === category) &&
      confOk
    );
  });

  const totalCollected = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);

  const act = async (p: StaffPayment, action: "approve" | "receive") => {
    if (!token) return;
    setBusyId(p.id);
    const res = await staffPaymentAction(token, p.id, action);
    setBusyId(null);
    if (res.error) return toast.error(res.error);
    toast.success(action === "approve" ? "M-Pesa payment approved" : "Cash marked as received");
    setDetail(null);
    refresh();
  };

  const exportCsv = () => {
    exportPaymentsCsv(filtered, data.property?.name ?? "BrightStay");
    toast.success("Excel (CSV) file downloaded");
  };
  const exportPdf = () => {
    exportPaymentsPdf(filtered, data.property?.name ?? "BrightStay");
    toast.success("PDF statement downloaded");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">
            {formatKES(totalCollected)} collected ·{" "}
            {awaiting.length > 0 ? (
              <span className="font-semibold text-amber-600">{awaiting.length} awaiting your confirmation</span>
            ) : (
              "all records confirmed"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={recordOpen ? () => setRecordOpen(false) : () => setRecordOpen(true)}>
            <ReceiptText className="h-4 w-4" /> Record payment
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={exportCsv}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={exportPdf}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Confirmation queue — the landlord's money-control board */}
      {awaiting.length > 0 && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4">
          <p className="text-sm font-bold text-amber-900">
            {awaiting.length} transaction{awaiting.length === 1 ? "" : "s"} awaiting landlord confirmation
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            Cash held by a caretaker → mark <em>received</em>. M-Pesa recorded by a caretaker → approve it. System (BrightPay) payments confirm automatically.
          </p>
          <div className="mt-3 space-y-2">
            {awaiting.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-card px-3 py-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  {(() => { const Icon = METHOD_ICON[p.method] ?? CircleEllipsis; return <Icon className="h-4 w-4" />; })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {p.tenantName} · House {p.houseNumber} · <span className="font-mono">{formatKES(p.amount)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.method} · {CATEGORY_LABEL[p.category] ?? p.category} ·{" "}
                    {p.confirmation?.cashHolder
                      ? `cash with ${p.confirmation.cashHolder}`
                      : `recorded by ${p.confirmation?.recordedByName ?? "staff"}`}
                  </p>
                </div>
                {isLandlord && (
                  <div className="flex gap-2">
                    {p.method === "Cash" ? (
                      <Button size="sm" className="h-8 rounded-lg" disabled={busyId === p.id} onClick={() => act(p, "receive")}>
                        <HandCoins className="h-3.5 w-3.5" /> Mark received
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 rounded-lg" disabled={busyId === p.id} onClick={() => act(p, "approve")}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tenant, house or reference…" className="h-11 rounded-xl pl-10" />
        </div>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="h-11 w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="M-Pesa">M-Pesa</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Bank">Bank</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="booking">Booking</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="awaiting">Awaiting confirmation</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="system">System-confirmed</SelectItem>
            <SelectItem value="pending">Transaction pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Recorded by</th>
                <th className="px-5 py-3 font-semibold">Confirmation</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((p) => {
                const Icon = METHOD_ICON[p.method] ?? CircleEllipsis;
                const conf = CONF_LABEL[p.confirmationStatus ?? "confirmed"] ?? CONF_LABEL.confirmed;
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => setDetail(p)}
                    data-testid={`payment-row-${p.id}`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {p.tenantName} <span className="text-xs font-normal text-muted-foreground">· House {p.houseNumber}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{CATEGORY_LABEL[p.category] ?? p.category}</td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{formatKES(p.amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Icon className="h-4 w-4" /> {p.method}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-muted-foreground">
                        {p.confirmationStatus === "auto_confirmed"
                          ? "System (BrightPay)"
                          : (p.recordedByName ?? "—")}
                        {p.recordedByRole ? <span className="block text-[11px] opacity-70">{p.recordedByRole}</span> : null}
                      </span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge tone={conf.tone}>{conf.label}</StatusBadge></td>
                    <td className="px-5 py-3.5 text-muted-foreground">{formatDate(p.paidAt)}</td>
                    <td className="px-5 py-3.5 text-right"><PaymentStatus status={p.status} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                    No payments found{payments.length === 0 ? " — allocations will record the first ones." : "."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Click any transaction for its full record. Payments are never overwritten — confirmations are appended for a traceable audit trail.
      </p>

      {/* ── Transaction detail dialog — the deep record ── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <ReceiptText className="h-5 w-5 text-brand-600" /> Transaction record
                </DialogTitle>
                <DialogDescription>Full, permanent record — click-to-copy reference.</DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border bg-gradient-to-br from-brand-50/60 to-transparent p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{CATEGORY_LABEL[detail.category] ?? detail.category} payment</p>
                <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">{formatKES(detail.amount)}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <PaymentStatus status={detail.status} />
                  {(() => {
                    const conf = CONF_LABEL[detail.confirmationStatus ?? "confirmed"] ?? CONF_LABEL.confirmed;
                    return <StatusBadge tone={conf.tone}>{conf.label}</StatusBadge>;
                  })()}
                </div>
              </div>

              <DetailField icon={UserRound} label="Tenant" value={`${detail.tenantName} · House ${detail.houseNumber}`} sub={detail.tenantPhone ?? undefined} />
              <DetailField icon={Wallet} label="Method" value={detail.method} sub={detail.confirmation?.system ? "Initiated on-platform (BrightPay)" : undefined} />
              <DetailField
                icon={Hash}
                label="Reference"
                value={detail.reference ?? "—"}
                mono
                copyable={!!detail.reference}
              />
              <DetailField
                icon={UserRound}
                label="Recorded by"
                value={
                  detail.confirmationStatus === "auto_confirmed"
                    ? "System — auto-confirmed"
                    : `${detail.recordedByName ?? "Staff"}${detail.recordedByRole ? ` (${detail.recordedByRole})` : ""}`
                }
              />
              <DetailField
                icon={ShieldCheck}
                label={detail.method === "Cash" ? "Cash custody" : "Approval trail"}
                value={
                  detail.confirmation?.cashHolder
                    ? `Cash held by ${detail.confirmation.cashHolder} — landlord has NOT yet received it`
                    : detail.confirmation?.awaitingAction
                      ? "Recorded by staff — awaiting landlord approval"
                      : detail.confirmation?.system
                        ? "System payment — confirmed automatically"
                        : detail.confirmation?.approvedBy
                          ? `Approved by ${detail.confirmation.approvedBy} · ${formatDate(detail.confirmation.approvedAt)}`
                          : detail.confirmation?.receivedBy
                            ? `Received by ${detail.confirmation.receivedBy} · ${formatDate(detail.confirmation.receivedAt)}`
                            : detail.confirmation?.recordedByName
                              ? `Recorded by ${detail.confirmation.recordedByName} (${detail.confirmation.recordedByRole ?? "staff"}) — confirmed on record`
                              : "—"
                }
              />
              <DetailField icon={CalendarDays} label="Paid on" value={formatDate(detail.paidAt)} />
              <DetailField icon={ReceiptText} label="Notes" value={detail.notes ?? "—"} />
              <DetailField icon={Hash} label="Record ID" value={detail.id} mono />
              <DetailField icon={CalendarDays} label="Record created" value={detail.createdAt ? formatDate(detail.createdAt) : "—"} />

              {isLandlord && detail.confirmationStatus === "awaiting_landlord" && (
                <div className="flex gap-2 border-t pt-3">
                  {detail.method === "Cash" ? (
                    <Button className="flex-1 rounded-xl" disabled={busyId === detail.id} onClick={() => act(detail, "receive")}>
                      <HandCoins className="h-4 w-4" /> Mark cash received
                    </Button>
                  ) : (
                    <Button className="flex-1 rounded-xl" disabled={busyId === detail.id} onClick={() => act(detail, "approve")}>
                      <ShieldCheck className="h-4 w-4" /> Approve payment
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Record a payment (staff) ── */}
      <RecordPaymentSheet
        open={recordOpen}
        onOpenChange={setRecordOpen}
        tenants={(data.tenants ?? []).map((t) => ({ id: t.id, label: `${t.fullName} · House ${t.houseNumber}` }))}
        token={token}
        onDone={() => {
          setRecordOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  sub,
  mono,
  copyable,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/20 px-3.5 py-2.5">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <p className={"truncate text-sm font-semibold text-foreground " + (mono ? "font-mono text-xs" : "")} title={value}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {copyable && (
        <button
          className="text-xs font-semibold text-brand-700 hover:underline"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => toast.success("Reference copied"),
              () => toast.error("Could not copy"),
            );
          }}
        >
          Copy
        </button>
      )}
    </div>
  );
}

function RecordPaymentSheet({
  open,
  onOpenChange,
  tenants,
  token,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenants: { id: string; label: string }[];
  token: string | null;
  onDone: () => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("rent");
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = Number(amount);
    if (!tenantId) return toast.error("Choose the tenant.");
    if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("Enter a valid amount.");
    if (!token) return toast.error("Session expired — sign in again.");
    setBusy(true);
    const res = await staffRecordPayment(token, {
      tenantId,
      amount: parsed,
      category,
      method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Payment recorded" + (method === "Cash" ? " — landlord must confirm receipt" : ""));
    setAmount(""); setReference(""); setNotes("");
    onDone();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Record a payment</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Money rules: cash you hold stays <em>awaiting</em> until the landlord marks it received; M-Pesa you record
            stays <em>awaiting</em> until the landlord approves. System (BrightPay) payments confirm automatically.
          </p>
          <FieldShell label="Tenant">
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choose tenant" /></SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell label="Amount (KES)">
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl" placeholder="e.g. 12000" />
          </FieldShell>
          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Type">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="booking">Booking</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FieldShell>
            <FieldShell label="Method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                </SelectContent>
              </Select>
            </FieldShell>
          </div>
          <FieldShell label="Reference (optional)">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-11 rounded-xl" placeholder="M-Pesa code / receipt no." />
          </FieldShell>
          <FieldShell label="Notes (optional)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" placeholder="Anything the landlord should know" />
          </FieldShell>
          <Button className="h-12 w-full rounded-xl" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save payment record"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
