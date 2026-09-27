import { Link } from "react-router-dom";
import { Banknote, TrendingUp, DoorOpen, ArrowUpRight, Wallet, Users, ChevronRight, Rocket, HandCoins, TriangleAlert, Wrench } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subMonths } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffData } from "@/hooks/useStaffData";
import { StatCard } from "@/components/app/StatCard";
import { SectionHeading } from "@/components/app/SectionHeading";
import { StatusBadge } from "@/components/app/StatusBadge";
import { formatKES, formatDateShort } from "@/lib/format";

export default function PortalDashboard() {
  const { user, role } = useAuth();
  const { data, loading } = useStaffData();

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      </div>
    );
  }

  const units = data.units;
  const payments = data.payments;
  const propertyName = data.property?.name ?? "BrightStay";
  const occupied = units.filter((u) => u.status === "occupied").length;
  const total = units.length;
  const occupancy = total ? Math.round((occupied / total) * 100) : 0;
  const rentRoll = units.filter((u) => u.status === "occupied").reduce((s, u) => s + u.monthlyRent, 0);

  const monthPrefix = format(new Date(), "yyyy-MM");
  const collected =
    payments
      .filter((p) => p.status === "completed" && p.paidAt?.startsWith(monthPrefix))
      .reduce((s, p) => s + p.amount, 0) || 0;

  // Collections series: 6 months of completed payments
  const series = (() => {
    const months: { key: string; label: string; rent: number }[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = subMonths(new Date(), m);
      months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM"), rent: 0 });
    }
    payments
      .filter((p) => p.status === "completed" && p.paidAt)
      .forEach((p) => {
        const slot = months.find((x) => x.key === p.paidAt.slice(0, 7));
        if (slot) slot.rent += p.amount;
      });
    return months.map(({ label, rent }) => ({ month: label, rent: Math.round(rent / 1000) }));
  })();

  const recentPayments = payments.slice(0, 4);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
            Welcome back, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "landlord" ? "Bird's-eye view across your estate." : `Here's what's happening at ${propertyName} today.`}
          </p>
        </div>
        <Link
          to="/portal/rooms"
          className="inline-flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-card transition hover:shadow-elevated"
        >
          <DoorOpen className="h-4 w-4 text-brand-600" /> {propertyName}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Monthly rent roll" value={formatKES(rentRoll)} hint={`${occupied} occupied units`} icon={Banknote} tone="gold" />
        <StatCard
          label={`Collected · ${format(new Date(), "MMM")}`}
          value={formatKES(collected)}
          hint={collected > 0 ? "This month's collections" : "No collections this month"}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Tenants"
          value={String(data.tenants.length)}
          hint={`${data.tenants.filter((t) => t.onboarded).length} onboarded`}
          icon={Users}
          tone="sky"
        />
        <StatCard label="Occupancy" value={`${occupancy}%`} hint={`${occupied} of ${total} units`} icon={DoorOpen} tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-foreground">Collections</p>
              <p className="text-xs text-muted-foreground">Payments received → last 6 months</p>
            </div>
            {series.some((p) => p.rent > 0) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <ArrowUpRight className="h-3.5 w-3.5" /> Live
              </span>
            )}
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="rent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand-400))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--brand-400))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="k" />
                <Tooltip
                  formatter={(v: number | string) => [`KES ${v}k`, undefined]}
                  contentStyle={{ borderRadius: 14, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-elevated)", fontSize: 13 }}
                />
                <Area type="monotone" dataKey="rent" name="Rent" stroke="hsl(var(--brand-400))" strokeWidth={2.5} fill="url(#rent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <p className="font-display text-lg font-semibold text-foreground">Attention needed</p>
          <div className="mt-3 space-y-3">
            {role === "landlord" && (data.summary?.awaitingCount ?? 0) > 0 && (
              <Link to="/portal/payments" className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 transition hover:shadow-card">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <HandCoins className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {data.summary?.awaitingCount} payment{data.summary?.awaitingCount === 1 ? "" : "s"} awaiting your confirmation
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Cash to receive or caretaker-recorded M-Pesa to approve.</p>
                </div>
                <ChevronRight className="ml-auto mt-1 h-4 w-4 text-stone-300" />
              </Link>
            )}
            {(data.summary?.outstanding ?? 0) > 0 && (
              <Link to="/portal/tenants" className="flex items-start gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 p-3 transition hover:shadow-card">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <TriangleAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{formatKES(data.summary?.outstanding ?? 0)} rent outstanding</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">See who has and hasn't paid this month on the Residents board.</p>
                </div>
                <ChevronRight className="ml-auto mt-1 h-4 w-4 text-stone-300" />
              </Link>
            )}
            {(data.summary?.openRequests ?? 0) > 0 && (
              <Link to="/portal/requests" className="flex items-start gap-3 rounded-xl border border-sky-200/60 bg-sky-50/60 p-3 transition hover:shadow-card">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <Wrench className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {data.summary?.openRequests} open maintenance request{data.summary?.openRequests === 1 ? "" : "s"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Tenants are waiting for updates.</p>
                </div>
                <ChevronRight className="ml-auto mt-1 h-4 w-4 text-stone-300" />
              </Link>
            )}
            <Link to="/portal/rooms" className="flex items-start gap-3 rounded-xl border border-brand-200/60 bg-brand-100/40 p-3 transition hover:shadow-card">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Rocket className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">
                  {vacantCount(units)} vacant unit{vacantCount(units) === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Allocate a vacant house to a new tenant from Rooms — deposit, rent and their access code in one flow.
                </p>
              </div>
              <ChevronRight className="ml-auto mt-1 h-4 w-4 text-stone-300" />
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-card">
        <div className="flex items-center justify-between px-5 pt-5">
          <SectionHeading eyebrow="Live" title="Recent payments" className="!flex-col !items-start" />
          <Link to="/portal/payments" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>
        </div>
        <div className="mt-3 divide-y divide-border/60">
          {recentPayments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{p.tenantName}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category === "deposit" ? "Initial deposit" : p.category === "rent" ? "Rent" : p.category} · {p.method} · {p.reference ?? "—"} · {formatDateShort(p.paidAt)}
                </p>
              </div>
              <p className="font-display text-[15px] font-semibold text-foreground">{formatKES(p.amount)}</p>
              <StatusBadge tone={p.status === "completed" ? "success" : p.status === "pending" ? "warning" : "danger"}>
                {p.status === "completed" ? "Completed" : p.status === "pending" ? "Pending" : p.status}
              </StatusBadge>
            </div>
          ))}
          {recentPayments.length === 0 && (
            <div className="px-5 py-10 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-semibold text-foreground">No payments yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Allocate a house to a tenant — their deposit and rent land here.</p>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-foreground">Unit occupancy</p>
            <p className="text-xs text-muted-foreground">
              {propertyName} · {occupied}/{total} occupied
            </p>
          </div>
          <span className="font-display text-2xl font-semibold text-gradient-brand">{occupancy}%</span>
        </div>
        <div className="mt-4 grid grid-cols-12 gap-1.5">
          {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
            <div key={i} className={"h-3 rounded-full " + (i < occupied ? "gradient-brand" : "bg-muted")} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full gradient-brand" /> Occupied</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted" /> Vacant</span>
          <Link to="/portal/rooms" className="ml-auto inline-flex items-center gap-1 text-brand-700 hover:underline">
            <Users className="h-3.5 w-3.5" /> {total - occupied} units to fill
          </Link>
        </div>
      </div>
    </div>
  );
}

function vacantCount(units: { status: string }[]): number {
  return units.filter((u) => u.status === "vacant").length;
}
