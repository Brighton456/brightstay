import { useEffect, useState } from "react";
import { Plus, Wrench, ClipboardList, Clock, CircleCheck } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { fetchTenantRequests, createTenantRequest, type TenantRequest } from "@/services/tenantPortal";
import { RequestStatus } from "@/components/app/StatusBadge";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/format";

const CATEGORY_STYLE: Record<string, string> = {
  Plumbing: "bg-sky-100 text-sky-700",
  Electrical: "bg-brand-100 text-brand-700",
  Structural: "bg-rose-100 text-rose-600",
  Household: "bg-stone-100 text-stone-600",
  Security: "bg-violet-100 text-violet-700",
  Other: "bg-stone-100 text-stone-600",
};

/**
 * Tenant maintenance requests — submitted to the server (maintenance_requests),
 * visible to the landlord/caretaker in the portal with a live status trail.
 */
export default function TenantRequests() {
  const { session } = useAppSession();
  const token = session?.kind === "tenant" ? session.token : null;
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("Plumbing");
  const [priority, setPriority] = useState("Medium");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<TenantRequest[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await fetchTenantRequests(token);
      if (!cancelled) {
        if (res.data?.requests) setRequests(res.data.requests);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (!token) return toast.error("Session expired — sign in again.");
    if (title.trim().length < 3) return toast.error("Please give the request a short title");
    setBusy(true);
    const res = await createTenantRequest(token, {
      category,
      priority,
      title: title.trim(),
      description: details.trim() || undefined,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Request sent — your caretaker can see it now");
    setTitle("");
    setDetails("");
    setOpen(false);
    const refreshed = await fetchTenantRequests(token);
    if (refreshed.data?.requests) setRequests(refreshed.data.requests);
  };

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Requests</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight text-foreground">Maintenance</h1>
        </div>
        <Button onClick={() => setOpen(true)} className="h-12 shrink-0 gap-2 rounded-xl sm:w-auto">
          <Plus className="h-5 w-5" /> New maintenance request
        </Button>
      </div>

      <div className="space-y-3">
        <SectionHeading eyebrow="Track" title="Your requests" />
        {loading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : requests && requests.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", CATEGORY_STYLE[r.category] ?? CATEGORY_STYLE.Other)}>
                      <Wrench className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{r.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.category} · {r.priority} · {formatDateShort(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <RequestStatus status={r.status} />
                </div>
                {r.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{r.description}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {r.status === "completed" || r.status === "closed" ? (
                    <><CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> Resolved{r.resolvedAt ? ` · ${formatDateShort(r.resolvedAt)}` : ""}</>
                  ) : (
                    <><Clock className="h-3.5 w-3.5" /> Status updates appear here as your caretaker works on it</>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No maintenance requests yet — report an issue any time and track its progress here.
          </p>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl sm:max-w-lg">
          <SheetHeader className="pb-4">
            <SheetTitle className="font-display text-lg">Report an issue</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Plumbing", "Electrical", "Structural", "Household", "Security", "Other"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Short title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bathroom tap leaking" className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Describe the issue</label>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="What's wrong, and since when?" className="rounded-xl" />
            </div>
            <Button onClick={submit} disabled={busy} className="h-12 w-full rounded-xl">
              {busy ? "Sending…" : "Submit request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
