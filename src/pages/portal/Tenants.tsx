import { useMemo, useState } from "react";
import {
  Search, UserRound, KeyRound, Phone, IdCard, HeartHandshake, Users,
  CalendarClock, Briefcase, Wallet, TriangleAlert, BadgeCheck, Clock, ReceiptText, ChevronRight,
} from "lucide-react";
import { useStaffData } from "@/hooks/useStaffData";
import { useAppSession } from "@/contexts/AppSessionContext";
import { staffSetTenantCredentials } from "@/services/staffAuth";
import { Avatar } from "@/components/app/Avatar";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatKES, formatDateShort, formatDate } from "@/lib/format";
import type { StaffTenant, RentLedgerMonth } from "@/services/staffAuth";
import { exportTableCsv, exportTablePdf } from "@/lib/exports";

type PayState = "paid" | "partial" | "unpaid" | "none";

function currentMonthState(t: StaffTenant): PayState {
  const period = new Date().toISOString().slice(0, 7);
  const m = t.rentLedger?.months?.find((x) => x.period === period);
  return (m?.status as PayState) ?? "none";
}

const MONTH_CHIP: Record<PayState, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  unpaid: "bg-rose-100 text-rose-700",
  none: "bg-stone-100 text-stone-500",
};

export default function PortalTenants() {
  const { data, loading } = useStaffData();
  const [query, setQuery] = useState("");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid" | "partial">("all");
  const [detail, setDetail] = useState<StaffTenant | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.tenants
      .map((t) => {
        const unit = data.units.find((u) => u.id === t.unitId);
        return {
          ...t,
          houseNumber: unit?.houseNumber ?? t.houseNumber ?? "—",
          rent: t.monthlyRent ?? unit?.monthlyRent ?? 0,
        };
      })
      .filter((t) => {
        const q = query.toLowerCase();
        if (!(t.fullName.toLowerCase().includes(q) || t.phone.includes(q) || t.houseNumber.toLowerCase().includes(q))) return false;
        if (payFilter === "all") return true;
        return currentMonthState(t) === payFilter;
      });
  }, [data, query, payFilter]);

  const counts = useMemo(() => {
    if (!data) return { paid: 0, unpaid: 0, partial: 0 };
    return data.tenants.reduce(
      (acc, t) => {
        const s = currentMonthState(t);
        if (s === "paid") acc.paid++;
        else if (s === "partial") acc.partial++;
        else if (s === "unpaid") acc.unpaid++;
        return acc;
      },
      { paid: 0, unpaid: 0, partial: 0 },
    );
  }, [data]);

  const exportTenants = () => {
    if (!data) return;
    const rowsOut: (string | number)[][] = [
      ["Tenant", "House", "Phone", "Monthly rent", "Months paid", "Partial", "Unpaid", "Outstanding", "Advance", "This month", "Since"],
      ...data.tenants.map((t) => {
        const s = t.rentLedger?.summary;
        return [
          t.fullName,
          t.houseNumber,
          t.phone,
          s?.monthlyRent ?? 0,
          s?.monthsPaid ?? 0,
          s?.monthsPartial ?? 0,
          s?.monthsUnpaid ?? 0,
          s?.outstanding ?? 0,
          s?.advance ?? 0,
          currentMonthState(t),
          formatDateShort(t.createdAt),
        ];
      }),
    ];
    exportTableCsv({ rows: rowsOut, filename: `BrightStay-tenants-rent-ledger.csv` });
    toast.success("Excel (CSV) ledger downloaded");
  };

  if (loading || !data) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  const propertyName = data.property?.name ?? "your property";
  const outstandingTotal = data.tenants.reduce((s, t) => s + (t.rentLedger?.summary?.outstanding ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Residents</h1>
          <p className="text-sm text-muted-foreground">
            {propertyName} · {data.tenants.length} tenant{data.tenants.length === 1 ? "" : "s"} ·{" "}
            <span className={outstandingTotal > 0 ? "font-semibold text-rose-600" : ""}>{formatKES(outstandingTotal)} rent outstanding</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or house…" className="h-11 rounded-xl pl-10" />
          </div>
          <Button variant="outline" className="h-11 gap-2 rounded-xl" onClick={exportTenants}>
            <ReceiptText className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Rent board — who has paid this month, who has not */}
      <div className="flex flex-wrap gap-2">
        {([
          { k: "all", label: `All (${data.tenants.length})` },
          { k: "paid", label: `Paid this month (${counts.paid})` },
          { k: "partial", label: `Partial (${counts.partial})` },
          { k: "unpaid", label: `Not paid (${counts.unpaid})` },
        ] as const).map((f) => (
          <button
            key={f.k}
            onClick={() => setPayFilter(f.k)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-bold transition",
              payFilter === f.k ? "bg-brand-600 text-white shadow-card" : "bg-card text-muted-foreground shadow-card hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-brand-200/60 bg-brand-100/40 p-3.5 text-xs leading-relaxed text-brand-800">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          New tenants are added from <span className="font-semibold">Rooms → Allocate tenant</span> on a vacant house —
          that records their initial deposit and rent and issues their 6-digit access code. Click any resident for their
          full record: wizard answers, contacts, and the month-by-month rent ledger.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-5 py-3 font-semibold">House</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Rent</th>
                <th className="px-5 py-3 font-semibold">Months paid</th>
                <th className="px-5 py-3 font-semibold">This month</th>
                <th className="px-5 py-3 font-semibold">Outstanding</th>
                <th className="px-5 py-3 text-right font-semibold">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((t) => {
                const state = currentMonthState(t);
                const s = t.rentLedger?.summary;
                return (
                  <tr key={t.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setDetail(t)} data-testid={`tenant-row-${t.id}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.fullName} hue="bg-gradient-to-br from-brand-500 to-brand-700" size="sm" />
                        <div>
                          <p className="font-semibold text-foreground">{t.fullName}</p>
                          <p className="text-[11px] text-muted-foreground">{t.onboarded ? "Profile complete" : "Onboarding pending"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">House {t.houseNumber}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{t.phone}</td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{t.rent ? formatKES(t.rent) : "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-emerald-700">{s?.monthsPaid ?? 0} paid</span>
                      {s && s.monthsUnpaid > 0 && <span className="text-rose-600"> · {s.monthsUnpaid} due</span>}
                      {s && s.monthsPartial > 0 && <span className="text-amber-600"> · {s.monthsPartial} partial</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge tone={state === "paid" ? "success" : state === "partial" ? "gold" : state === "unpaid" ? "danger" : "neutral"}>
                        {state === "paid" ? "Paid" : state === "partial" ? "Partial" : state === "unpaid" ? "Not paid" : "No lease"}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-3.5">
                      {(s?.outstanding ?? 0) > 0 ? (
                        <span className="font-semibold text-rose-600">{formatKES(s!.outstanding)}</span>
                      ) : (
                        <span className="text-emerald-600">Clear</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                    <UserRound className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    No residents match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Deep tenant record drawer ── */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
          {detail && <TenantDetail tenant={detail} onClose={() => setDetail(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TenantDetail({ tenant: t, onClose }: { tenant: StaffTenant; onClose: () => void }) {
  const s = t.rentLedger?.summary;
  const wizard = t.wizard ?? {};
  const step1 = wizard["1"];
  const step2 = wizard["2"];
  const step3 = wizard["3"];
  const emergency = t.emergencyContacts ?? step3?.contacts ?? [];

  const exportLedger = () => {
    exportTablePdf({
      title: "Tenant rent ledger",
      name: t.fullName,
      subtitle: `House ${t.houseNumber} · rent ledger as at ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`,
      head: ["Month", "Due", "Paid", "Status"],
      body: (t.rentLedger?.months ?? []).map((m) => [m.label, formatKES(m.due), formatKES(m.paid), m.status]),
      filename: `BrightStay-${t.fullName.replace(/\s+/g, "-")}-ledger.pdf`,
      totalsLine: s ? `Outstanding: ${formatKES(s.outstanding)} · Paid in advance: ${formatKES(s.advance)}` : undefined,
    });
    toast.success("Tenant ledger PDF downloaded");
  };

  return (
    <div>
      <SheetHeader className="border-b px-5 pb-4 pt-5">
        <SheetTitle className="font-display">Tenant record</SheetTitle>
      </SheetHeader>

      <div className="space-y-5 px-5 py-5">
        {/* Identity header */}
        <div className="flex items-center gap-4">
          <Avatar name={t.fullName} hue="bg-gradient-to-br from-brand-500 to-brand-700" size="lg" />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-foreground">{t.fullName}</p>
            <p className="text-sm text-muted-foreground">House {t.houseNumber} · {t.unitType ?? "—"} · {formatKES(t.monthlyRent ?? 0)}/mo</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge tone={t.onboarded ? "success" : "warning"}>{t.onboarded ? "Profile complete" : "Onboarding pending"}</StatusBadge>
              {s && s.outstanding > 0 && <StatusBadge tone="danger">{formatKES(s.outstanding)} due</StatusBadge>}
            </div>
          </div>
        </div>

        {/* Rent ledger */}
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Rent ledger</p>
            <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={exportLedger}>
              <ReceiptText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(t.rentLedger?.months ?? []).slice().reverse().map((m: RentLedgerMonth) => (
              <span key={m.period} title={`${m.label}: due ${formatKES(m.due)}, paid ${formatKES(m.paid)}`} className={cn("rounded-lg px-2 py-1 text-[10px] font-bold", MONTH_CHIP[m.status])}>
                {m.label}
              </span>
            ))}
            {(!t.rentLedger || t.rentLedger.months.length === 0) && <p className="text-xs text-muted-foreground">No rent history yet.</p>}
          </div>
          {s && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 py-2">
                <p className="font-display text-base font-semibold text-emerald-700">{s.monthsPaid}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Months paid</p>
              </div>
              <div className="rounded-xl bg-rose-50 py-2">
                <p className="font-display text-base font-semibold text-rose-700">{formatKES(s.outstanding)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Outstanding</p>
              </div>
              <div className="rounded-xl bg-sky-50 py-2">
                <p className="font-display text-base font-semibold text-sky-700">{formatKES(s.advance)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Advance</p>
              </div>
            </div>
          )}
        </section>

        {/* Contact & identity */}
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Contacts & identity</p>
          <DetailRow icon={Phone} label="Phone" value={t.phone} />
          {step1?.fullNames && <DetailRow icon={UserRound} label="Full names (wizard)" value={step1.fullNames} />}
          {step1?.idNumber && <DetailRow icon={IdCard} label="ID number" value={step1.idNumber} />}
          {step1?.residents && step1.residents.length > 0 && (
            <DetailRow icon={Users} label="Co-residents declared" value={step1.residents.map((r) => `${r.fullName}${r.phone ? ` (${r.phone})` : ""}`).join(" · ")} />
          )}
          {(t.household ?? []).length > 0 && (
            <DetailRow icon={Users} label="Household on file" value={t.household!.map((h) => `${h.fullName}${h.phone ? ` (${h.phone})` : ""}`).join(" · ")} />
          )}
        </section>

        {/* Status / occupation */}
        {(step2?.maritalStatus || step2?.occupation || step2?.incomeSource || step2?.intendedStayMonths) && (
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Status (wizard)</p>
            {step2?.maritalStatus && <DetailRow icon={HeartHandshake} label="Marital status" value={step2.maritalStatus} />}
            {typeof step2?.familyMemberCount === "number" && <DetailRow icon={Users} label="Family members" value={String(step2.familyMemberCount)} />}
            {step2?.occupation && <DetailRow icon={Briefcase} label="Occupation" value={step2.occupation} />}
            {step2?.incomeSource && <DetailRow icon={Wallet} label="Income source" value={step2.incomeSource} />}
            {typeof step2?.intendedStayMonths === "number" && <DetailRow icon={CalendarClock} label="Intended stay" value={`${step2.intendedStayMonths} month(s)`} />}
          </section>
        )}

        {/* Emergency contacts */}
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Emergency contacts</p>
          {emergency.length > 0 ? (
            emergency.map((c, i) => (
              <DetailRow key={i} icon={HeartHandshake} label={`${c.name} · ${c.relationship}${c.county ? ` · ${c.county}` : ""}`} value={c.phone} />
            ))
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">None recorded yet.</p>
          )}
        </section>

        {/* Sign-in credentials (landlord only) */}
        <TenantCredentials tenant={t} />

        {/* Payment history */}
        <TenantPaymentHistory tenantId={t.id} />

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" /> Tenant since {formatDate(t.createdAt)}
          {t.onboardingCompletedAt && ` · onboarded ${formatDate(t.onboardingCompletedAt)}`}
        </p>
        <Button variant="outline" className="w-full rounded-xl" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/** Lands in the Drawer copy: 8-char temp password the tenant must replace. */
function tempPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Landlord-only credential issue/reset. A tenant who loses their password (or
 * never got one) is handed a fresh username + temporary password here; the
 * server forces them to choose their own on the next sign-in.
 */
function TenantCredentials({ tenant: t }: { tenant: StaffTenant }) {
  const { token } = useStaffData();
  const { session } = useAppSession();
  const isLandlord = session?.kind === "staff" && session.user.role === "landlord";
  const [username, setUsername] = useState((t.phone ?? "").replace(/\D/g, ""));
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const issue = async () => {
    if (!token) return toast.error("Your session has expired — sign in again.");
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (clean.length < 3) return toast.error("Username needs at least 3 characters (letters, numbers, . _ -).");
    const password = tempPassword();
    setBusy(true);
    const res = await staffSetTenantCredentials(token, { tenantId: t.id, username: clean, password });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    setIssued({ username: res.data?.username ?? clean, password });
    toast.success("Credentials issued — share them privately");
  };

  return (
    <section className="space-y-2" data-testid="tenant-credentials">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Sign-in credentials</p>
      {issued ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <p className="text-xs font-semibold text-emerald-900">
            Share these with {t.fullName.split(" ")[0]} privately (SMS or WhatsApp):
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Username</p>
              <p className="select-all font-mono text-sm font-semibold text-foreground">{issued.username}</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Temp password</p>
              <p className="select-all font-mono text-sm font-semibold text-foreground">{issued.password}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1 rounded-lg"
              onClick={() => {
                navigator.clipboard
                  .writeText(`BrightStay login\nUsername: ${issued.username}\nPassword: ${issued.password}`)
                  .then(() => toast.success("Copied"))
                  .catch(() => toast.error("Could not copy"));
              }}
            >
              Copy
            </Button>
            <Button size="sm" variant="outline" className="h-8 flex-1 rounded-lg" onClick={() => setIssued(null)}>
              Done
            </Button>
          </div>
          <p className="text-[11px] text-emerald-800">
            {t.fullName.split(" ")[0]} must set their own password the first time they sign in.
          </p>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border bg-card p-3.5">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (e.g. 0712345678)"
            className="h-11 rounded-xl"
            data-testid="tenant-credential-username"
            aria-label="Tenant username"
          />
          <Button
            onClick={issue}
            disabled={busy || !isLandlord}
            variant="outline"
            className="h-10 w-full gap-2 rounded-xl"
            title={isLandlord ? undefined : "Only the landlord can issue tenant credentials"}
          >
            <KeyRound className="h-4 w-4" />
            {busy ? "Issuing…" : "Issue username & temp password"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {isLandlord
              ? "Creates a new temporary password. The tenant changes it on first sign-in."
              : "Only the landlord can issue or reset tenant credentials."}
          </p>
        </div>
      )}
    </section>
  );
}

function TenantPaymentHistory({ tenantId }: { tenantId: string }) {
  const { data } = useStaffData();
  const payments = (data?.payments ?? []).filter((p) => p.tenantId === tenantId);
  if (payments.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Payment history</p>
      {payments.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5">
          <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", p.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
            {p.status === "completed" ? <BadgeCheck className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{formatKES(p.amount)} · {p.method}</p>
            <p className="text-[11px] text-muted-foreground">
              {p.category} · {formatDate(p.paidAt)}
              {p.confirmationStatus === "awaiting_landlord" && " · awaiting confirmation"}
              {p.confirmation?.cashHolder && ` · cash with ${p.confirmation.cashHolder}`}
            </p>
          </div>
        </div>
      ))}
      {(data?.tenants ?? []).some((t) => t.rentLedger?.summary && t.rentLedger.summary.outstanding > 0) && (
        <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Unpaid months above exclude pending/failed transactions — only completed rent payments count.
        </p>
      )}
    </section>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/20 px-3.5 py-2.5">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
