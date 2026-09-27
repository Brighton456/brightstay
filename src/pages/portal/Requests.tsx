import { useState } from "react";
import { Wrench, Search } from "lucide-react";
import { useStaffData } from "@/hooks/useStaffData";
import { staffRequestUpdate } from "@/services/staffAuth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RequestStatus } from "@/components/app/StatusBadge";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";

const CATEGORY_STYLE: Record<string, string> = {
  Plumbing: "bg-sky-100 text-sky-700",
  Electrical: "bg-brand-100 text-brand-700",
  Structural: "bg-rose-100 text-rose-600",
  Household: "bg-stone-100 text-stone-600",
  Security: "bg-violet-100 text-violet-700",
  Other: "bg-stone-100 text-stone-600",
};

const NEXT_STATUS: Record<string, string[]> = {
  submitted: ["in_review", "in_progress", "completed"],
  in_review: ["in_progress", "completed"],
  in_progress: ["completed", "closed"],
  completed: ["closed"],
  closed: [],
};

export default function PortalRequests() {
  const { data, loading, token, refresh } = useStaffData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading || !data) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  const propertyName = data.property?.name ?? "your property";
  const requests = data.requests ?? [];

  const filtered = requests.filter((r) => {
    const q = query.toLowerCase();
    const matchQ =
      r.title.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      r.houseNumber.toLowerCase().includes(q) ||
      (r.tenantName ?? "").toLowerCase().includes(q);
    return matchQ && (statusFilter === "all" || r.status === statusFilter);
  });

  const openCount = requests.filter((r) => !["completed", "closed"].includes(r.status)).length;

  const update = async (id: string, status: string) => {
    if (!token) return;
    setBusyId(id);
    const res = await staffRequestUpdate(token, id, status);
    setBusyId(null);
    if (res.error) return toast.error(res.error);
    toast.success("Request updated — the tenant sees the new status");
    refresh();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Maintenance</h1>
          <p className="text-sm text-muted-foreground">
            {propertyName} · {requests.length} request{requests.length === 1 ? "" : "s"} ·{" "}
            {openCount > 0 ? <span className="font-semibold text-amber-600">{openCount} open</span> : "all resolved"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests…" className="h-11 rounded-xl pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-36 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="in_review">In review</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card" data-testid={`request-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (CATEGORY_STYLE[r.category] ?? CATEGORY_STYLE.Other)}>
                    <Wrench className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      House {r.houseNumber} · {r.tenantName ?? "Former tenant"} · {relativeTime(r.createdAt)}
                    </p>
                  </div>
                </div>
                <RequestStatus status={r.status} />
              </div>
              {r.description && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{r.description}</p>}
              {NEXT_STATUS[r.status]?.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Move to</span>
                  {NEXT_STATUS[r.status].map((s) => (
                    <Button key={s} size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-[11px]" disabled={busyId === r.id} onClick={() => update(r.id, s)}>
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <Wrench className="mx-auto mb-2 h-6 w-6 opacity-40" />
          {requests.length === 0
            ? "Tenant-submitted requests will appear here once tenants start reporting issues."
            : "No requests match this view."}
        </div>
      )}
    </div>
  );
}
