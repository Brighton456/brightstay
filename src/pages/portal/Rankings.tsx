import { Navigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffData } from "@/hooks/useStaffData";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES } from "@/lib/format";

export default function PortalRankings() {
  const { role } = useAuth();
  const { data, loading } = useStaffData();
  if (role !== "landlord") return <Navigate to="/portal" replace />;

  if (loading || !data) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  const name = data.property?.name || "BrightStay";

  const byTenant = new Map<string, number>();
  data.payments
    .filter((p) => p.status === "completed" && p.category === "rent")
    .forEach((p) => byTenant.set(p.tenantName, (byTenant.get(p.tenantName) ?? 0) + p.amount));
  const topPaying = Array.from(byTenant.entries())
    .map(([tenant, amount]) => ({ tenant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const depositHolders = data.tenants
    .map((t) => {
      const unit = data.units.find((u) => u.id === t.unitId);
      return { tenant: t.fullName, house: unit ? `House ${unit.houseNumber}` : "—", value: unit?.deposit ?? 0 };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const vacancies = data.units
    .filter((u) => u.status === "vacant")
    .sort((a, b) => b.monthlyRent - a.monthlyRent)
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Rankings</h1>
        <p className="text-sm text-muted-foreground">{name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <SectionHeading eyebrow="Performance" title="Top paying tenants" />
          {topPaying.length > 0 ? (
            <div className="mt-3 space-y-2">
              {topPaying.map(({ tenant, amount }, i) => (
                <div key={tenant} className="flex items-center justify-between rounded-xl p-3 text-sm ring-1 ring-border/50">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-display text-sm font-bold text-brand-700">#{i + 1}</span>
                    <span className="truncate font-medium text-foreground">{tenant}</span>
                  </span>
                  <span className="font-semibold text-emerald-700">{formatKES(amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">No rent payments yet.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <SectionHeading eyebrow="Deposits" title="Deposits held per tenant" />
          {depositHolders.length > 0 ? (
            <div className="mt-3 space-y-2">
              {depositHolders.map(({ tenant, house, value }) => (
                <div key={tenant} className="flex items-center justify-between rounded-xl p-3 text-sm ring-1 ring-border/50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{tenant}</span>
                    <span className="text-xs text-muted-foreground">{house}</span>
                  </span>
                  <span className="font-semibold text-brand-700">{formatKES(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">No tenants yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <SectionHeading eyebrow="Availability" title="Highest-value vacancies" />
        {vacancies.length > 0 ? (
          <div className="mt-3 space-y-2">
            {vacancies.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl p-3 text-sm ring-1 ring-border/50">
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">House {u.houseNumber}</span>
                  <span className="text-xs text-muted-foreground">{u.type}</span>
                </span>
                <span className="font-semibold text-amber-600">{formatKES(u.monthlyRent)}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            <Trophy className="h-4 w-4" /> Fully occupied — no vacancies.
          </div>
        )}
      </div>
    </div>
  );
}
