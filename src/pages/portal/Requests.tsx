import { Wrench, Search } from "lucide-react";
import { useState } from "react";
import { useStaffData } from "@/hooks/useStaffData";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestStatus } from "@/components/app/StatusBadge";

const CATEGORY_STYLE: Record<string, string> = {
  Plumbing: "bg-sky-100 text-sky-700",
  Electrical: "bg-brand-100 text-brand-700",
  Structural: "bg-rose-100 text-rose-600",
  Household: "bg-stone-100 text-stone-600",
  Security: "bg-violet-100 text-violet-700",
};

export default function PortalRequests() {
  const { data, loading } = useStaffData();
  const [query, setQuery] = useState("");

  if (loading || !data) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  const propertyName = data.property?.name ?? "your property";

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Maintenance</h1>
          <p className="text-sm text-muted-foreground">Requests across {propertyName}</p>
        </div>
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests…" className="h-11 rounded-xl pl-10" />
        </div>
      </div>

      <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <Wrench className="mx-auto mb-2 h-6 w-6 opacity-40" />
        Tenant-submitted requests will appear here once tenants start reporting issues.
      </div>
    </div>
  );
}
