import { useEffect, useState } from "react";
import { MapPin, Home as HomeIcon, DoorOpen, BadgeCheck, Banknote, Clock, Droplets, PlugZap } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { fetchTenantSession, type TenantDashboardData } from "@/services/tenantPortal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES } from "@/lib/format";

export default function TenantHouse() {
  const { session } = useAppSession();
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.kind !== "tenant") return;
    let cancelled = false;
    (async () => {
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
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const unit = data?.unit;
  if (!unit) {
    return (
      <div className="rounded-3xl border border-dashed border-brand-300/70 bg-brand-50/60 p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-foreground">No home assigned yet</h2>
        <p className="mt-2 text-sm text-brand-800/80">Your caretaker will link you to a room once your allocation is ready.</p>
      </div>
    );
  }

  const propertyName = data?.property?.name ?? "BrightStay";
  const location = data?.property?.location ?? "";

  const DETAILS = [
    { label: "Unit type", value: unit.type, icon: DoorOpen },
    { label: "Monthly rent", value: formatKES(unit.monthlyRent), icon: Banknote },
    { label: "Security deposit", value: formatKES(unit.deposit), icon: BadgeCheck },
    {
      label: "Utilities",
      value: `${unit.water === "included" ? "Water incl." : "Water self-paid"} · ${unit.electricity === "included" ? "Power incl." : "Power self-paid"}`,
      icon: unit.water === "included" ? Droplets : PlugZap,
    },
  ];

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">My home</p>
        <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight text-foreground">House {unit.houseNumber}</h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-brand-600" />
          {propertyName}{location ? `, ${location}` : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-[26px] border bg-gradient-to-br from-brand-500 via-brand-600 to-bronze p-6">
        <div className="flex items-end justify-between">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-brand-700 shadow-elevated">
            <HomeIcon className="h-7 w-7" />
          </span>
          <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-800 backdrop-blur">
            Your home
          </span>
        </div>
        <p className="mt-6 font-display text-2xl font-semibold text-foreground">House {unit.houseNumber}</p>
        <p className="text-sm font-medium text-brand-800/80">{propertyName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DETAILS.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-card p-4 shadow-card">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-3 font-display text-lg font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-brand-300/70 bg-brand-50/60 p-4 text-sm text-brand-900">
        <p className="flex items-center gap-1.5 font-semibold">
          <Clock className="h-4 w-4" /> Tenancy
        </p>
        <p className="mt-1 text-xs leading-relaxed text-brand-800/80">
          Active tenancy — allocated by your caretaker. Your full lease agreement will appear here once uploaded.
        </p>
      </div>
    </div>
  );
}
