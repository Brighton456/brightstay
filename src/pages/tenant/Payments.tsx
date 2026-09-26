import { useEffect, useState } from "react";
import { Download, Smartphone, Wallet, Hash, Receipt } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { fetchTenantSession, type TenantDashboardData } from "@/services/tenantPortal";
import { PaymentStatus } from "@/components/app/StatusBadge";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES, formatDate } from "@/lib/format";
import { toast } from "sonner";

export default function TenantPayments() {
  const { session } = useAppSession();
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.kind !== "tenant") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchTenantSession(session.token);
      if (!cancelled) {
        setData(res.data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

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

  const categoryLabel = (c: string) =>
    c === "deposit" ? "Initial deposit" : c === "rent" ? "Initial rent" : c === "booking" ? "Booking fee" : "Other";

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Payments</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight text-foreground">Your receipts</h1>
        </div>
        <button
          onClick={() => toast.info("Your full statement will be downloadable soon")}
          className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card"
        >
          <Download className="h-3.5 w-3.5" /> Statement
        </button>
      </div>

      <div className="space-y-3">
        <SectionHeading eyebrow="Receipts" title="Payments on your account" />
        {payments.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center gap-3.5 rounded-2xl border bg-card p-4 shadow-card">
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
                    <PaymentStatus status={p.status === "completed" ? "completed" : "pending"} />
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
            No payments recorded yet — your caretaker's entries will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
