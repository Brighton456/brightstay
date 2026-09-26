import { useState } from "react";
import { Plus, Wrench, ClipboardList } from "lucide-react";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<string, string> = {
  Plumbing: "bg-sky-100 text-sky-700",
  Electrical: "bg-brand-100 text-brand-700",
  Structural: "bg-rose-100 text-rose-600",
  Household: "bg-stone-100 text-stone-600",
  Security: "bg-violet-100 text-violet-700",
};

/**
 * Tenant maintenance requests — v1 keeps a local draft list per device.
 * Server-side submission arrives with the tenant-request RPC (next milestone).
 */
export default function TenantRequests() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("Plumbing");
  const [priority, setPriority] = useState("Medium");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const [drafts, setDrafts] = useState<
    { id: number; category: string; priority: string; title: string; description: string; createdAt: number }[]
  >([]);

  const submit = () => {
    if (!title.trim()) return toast.error("Please give the request a short title");
    setDrafts((d) => [
      ...d,
      {
        id: Date.now(),
        category,
        priority,
        title: title.trim(),
        description: details.trim(),
        createdAt: Date.now(),
      },
    ]);
    toast.success("Request recorded — your caretaker will see it at handover");
    setTitle("");
    setDetails("");
    setOpen(false);
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
        {drafts.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {drafts.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", CATEGORY_STYLE[r.category])}>
                    <Wrench className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.category} · just now</p>
                  </div>
                </div>
                {r.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{r.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No maintenance requests yet — report an issue any time.
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
                    {["Plumbing", "Electrical", "Structural", "Household", "Security"].map((c) => (
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
            <Button onClick={submit} className="h-12 w-full rounded-xl">Submit request</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
