import { useState } from "react";
import { Search, UserRound, KeyRound } from "lucide-react";
import { useStaffData } from "@/hooks/useStaffData";
import { Avatar } from "@/components/app/Avatar";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES, formatDateShort } from "@/lib/format";

export default function PortalTenants() {
  const { data, loading } = useStaffData();
  const [query, setQuery] = useState("");

  if (loading || !data) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  const propertyName = data.property?.name ?? "your property";
  const rows = data.tenants
    .map((t) => {
      const unit = data.units.find((u) => u.id === t.unitId);
      return { ...t, houseNumber: unit?.houseNumber ?? "—", rent: unit?.monthlyRent ?? 0 };
    })
    .filter((t) => {
      const q = query.toLowerCase();
      return t.fullName.toLowerCase().includes(q) || t.phone.includes(q) || t.houseNumber.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Residents</h1>
          <p className="text-sm text-muted-foreground">
            {propertyName} · {data.tenants.length} tenant{data.tenants.length === 1 ? "" : "s"} ·{" "}
            {data.units.filter((u) => u.status === "vacant").length} vacant rooms
          </p>
        </div>
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or house…" className="h-11 rounded-xl pl-10" />
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-brand-200/60 bg-brand-100/40 p-3.5 text-xs leading-relaxed text-brand-800">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          New tenants are added from <span className="font-semibold">Rooms → Allocate tenant</span> on a vacant house —
          that records their initial deposit and rent and issues their 6-digit access code. They finish their own
          profile at <span className="font-semibold">/auth → "New tenant?"</span>.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-5 py-3 font-semibold">House</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Rent</th>
                <th className="px-5 py-3 font-semibold">Since</th>
                <th className="px-5 py-3 text-right font-semibold">Setup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={t.fullName} hue="bg-gradient-to-br from-brand-500 to-brand-700" size="sm" />
                      <p className="font-semibold text-foreground">{t.fullName}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-foreground">House {t.houseNumber}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{t.phone}</td>
                  <td className="px-5 py-3.5 font-medium text-foreground">{t.rent ? formatKES(t.rent) : "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{formatDateShort(t.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge tone={t.onboarded ? "success" : "warning"}>
                      {t.onboarded ? "Profile done" : "Pending"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <UserRound className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    No residents yet — allocate a vacant house to add your first tenant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
