import { Banknote, TrendingUp, Wallet } from "lucide-react";
import { useStaffData } from "@/hooks/useStaffData";
import { StatCard } from "@/components/app/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES, formatDateShort } from "@/lib/format";

export default function PortalAccounting() {
  const { data, loading } = useStaffData();

  if (loading || !data) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  const completed = data.payments.filter((p) => p.status === "completed");
  const deposits = completed.filter((p) => p.category === "deposit").reduce((s, p) => s + p.amount, 0);
  const rent = completed.filter((p) => p.category === "rent").reduce((s, p) => s + p.amount, 0);
  const rentRoll = data.units.filter((u) => u.status === "occupied").reduce((s, u) => s + u.monthlyRent, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Accounting</h1>
        <p className="text-sm text-muted-foreground">{data.property?.name ?? "BrightStay"} · collections ledger</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rent collected" value={formatKES(rent)} hint="All completed rent" icon={Banknote} tone="green" />
        <StatCard label="Deposits held" value={formatKES(deposits)} hint="Refundable at move-out" icon={Wallet} tone="gold" />
        <StatCard label="Monthly rent roll" value={formatKES(rentRoll)} hint="From occupied units" icon={TrendingUp} tone="sky" />
        <StatCard label="Payments" value={String(completed.length)} hint="Recorded transactions" icon={Banknote} tone="neutral" />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-5 py-3 font-semibold">House</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {completed.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3.5 font-semibold text-foreground">{p.tenantName}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">House {p.houseNumber}</td>
                  <td className="px-5 py-3.5 capitalize text-muted-foreground">{p.category}</td>
                  <td className="px-5 py-3.5 font-medium text-foreground">{formatKES(p.amount)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{formatDateShort(p.paidAt)}</td>
                </tr>
              ))}
              {completed.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No completed payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
