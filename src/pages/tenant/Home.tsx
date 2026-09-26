import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Home as HomeIcon, Wallet, Receipt, CheckCircle2, Clock, Hash, ChevronRight } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { fetchTenantSession, type TenantDashboardData } from "@/services/tenantPortal";
import { StatusBadge } from "@/components/app/StatusBadge";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES } from "@/lib/format";

/**
 * Tenant dashboard — shows the unit, the household and (prominently) the
 * initial payments the caretaker recorded at allocation.
 */
export default function TenantHome() {
  const { session, refreshTenantSession } = useAppSession();
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshTenantSession();
  }, [refreshTenantSession]);

  useEffect(() => {
    if (session?.kind !== "tenant") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchTenantSession(session.token);
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error ?? "Could not load your dashboard."} — try refreshing, or ask your caretaker to re-issue your code.
      </p>
    );
  }

  const unit = data.unit;
  const deposit = data.payments.find((p) => p.category === "deposit") ?? null;
  const rent = data.payments.find((p) => p.category === "rent") ?? null;
  const firstName = data.tenant.fullName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {data.property?.name ?? "BrightStay"}{data.property?.location ? ` · ${data.property.location}` : ""}
          </p>
          <h1 className="mt-0.5 font-display text-[26px] font-semibold tracking-tight text-foreground">
            {greeting}, {firstName}
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Home sweet home
        </span>
      </div>

      {/* Initial payments — recorded by staff at allocation */}
      <div className="space-y-3">
        <SectionHeading eyebrow="Your records" title="Initial payments" />
        <div className="grid gap-3 sm:grid-cols-2">
          <PaymentCard
            title="Initial deposit"
            amount={deposit?.amount ?? null}
            method={deposit?.method ?? null}
            reference={deposit?.reference ?? null}
            paidAt={deposit?.paidAt ?? null}
            tone="deposit"
          />
          <PaymentCard
            title="Initial rent"
            amount={rent?.amount ?? null}
            method={rent?.method ?? null}
            reference={rent?.reference ?? null}
            paidAt={rent?.paidAt ?? null}
            tone="rent"
          />
        </div>
      </div>

      {/* House snapshot */}
      <Link to="/app/house" className="block">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
          <div className="h-24 bg-gradient-to-br from-brand-500 via-brand-600 to-bronze" />
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <HomeIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-[15px] font-semibold text-foreground">
                  {unit ? `House ${unit.houseNumber}` : "Your house"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {unit ? `${unit.type} · ${formatKES(unit.monthlyRent)}/month` : "Details coming soon"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-300" />
          </div>
        </div>
      </Link>

      {/* Household */}
      {data.household.length > 0 && (
        <div className="space-y-3">
          <SectionHeading eyebrow="Your home" title="Living with you" />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.household.map((r, i) => (
              <div key={i} className="rounded-2xl border bg-card p-4 shadow-card">
                <p className="text-sm font-semibold text-foreground">{r.fullName}</p>
                <p className="text-xs text-muted-foreground">{r.phone || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentCard({
  title,
  amount,
  method,
  reference,
  paidAt,
  tone,
}: {
  title: string;
  amount: number | null;
  method: string | null;
  reference: string | null;
  paidAt: string | null;
  tone: "deposit" | "rent";
}) {
  const recorded = amount != null;
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card" data-testid={`payment-${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <StatusBadge tone={recorded ? "success" : "warning"}>
          {recorded ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Received</span> : <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>}
        </StatusBadge>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
        {recorded ? formatKES(amount) : "—"}
      </p>
      {recorded && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> {method ?? "—"}</span>
          {reference && (
            <span className="inline-flex items-center gap-1 font-mono"><Hash className="h-3.5 w-3.5" /> {reference}</span>
          )}
          {paidAt && (
            <span className="inline-flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> {new Date(paidAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
          )}
        </p>
      )}
    </div>
  );
}
