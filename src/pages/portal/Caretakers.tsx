import { useState } from "react";
import { Plus, Shield, KeyRound, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffData } from "@/hooks/useStaffData";
import { staffCreateCaretaker, staffSetPermission } from "@/services/staffAuth";
import { Avatar } from "@/components/app/Avatar";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function PortalCaretakers() {
  const { role } = useAuth();
  const { data, loading, token } = useStaffData();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ username: "", fullName: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const isLandlord = role === "landlord";

  if (loading || !data) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  const propertyName = data.property?.name ?? "your property";

  const togglePermission = async (username: string, canAllocate: boolean) => {
    if (!token) return;
    const res = await staffSetPermission(token, username, canAllocate);
    if (res.error) return toast.error(res.error);
    toast.success(canAllocate ? `${username} can now allocate units` : `${username} can no longer allocate units`);
    window.location.reload(); // simplest way to refetch overview
  };

  const submitInvite = async () => {
    if (!token) return;
    if (!form.username.trim() || !form.fullName.trim()) return toast.error("Username and full name are required.");
    if (form.password.length < 8) return toast.error("Temporary password must be at least 8 characters.");
    setBusy(true);
    const res = await staffCreateCaretaker(token, form.username.trim(), form.fullName.trim(), form.phone.trim(), form.password);
    setBusy(false);
    if (res.error || !res.data) return toast.error(res.error ?? "Could not create the caretaker.");
    toast.success(`Caretaker @${res.data.username} created`, {
      description: "Share their username + password — they'll set a new one at first login.",
    });
    setInviteOpen(false);
    setForm({ username: "", fullName: "", phone: "", password: "" });
    window.location.reload();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Staff & permissions</h1>
          <p className="text-sm text-muted-foreground">Who can act at {propertyName}</p>
        </div>
        {isLandlord && (
          <Button className="gap-2 rounded-xl" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Add caretaker
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.staff.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={s.fullName} hue="bg-gradient-to-br from-brand-400 to-brand-700" size="lg" />
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">{s.fullName}</p>
                  <p className="text-xs capitalize text-muted-foreground">{s.role} · @{s.username}</p>
                </div>
              </div>
              <StatusBadge tone={s.isActive ? "success" : "danger"}>{s.isActive ? "Active" : "Disabled"}</StatusBadge>
            </div>

            <div className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Shield className="h-4 w-4 text-brand-600" /> Allocate vacant units
                </span>
                {s.role === "landlord" ? (
                  <span className="text-xs font-semibold text-stone-500">Always</span>
                ) : (
                  <Switch
                    checked={s.canAllocate}
                    onCheckedChange={(v) => (isLandlord ? togglePermission(s.username, v) : toast.info("Landlord only"))}
                    disabled={!isLandlord}
                  />
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-sm text-muted-foreground">Financial reports</span>
                <span className="text-xs font-semibold text-stone-500">{s.role === "landlord" ? "Enabled" : "Landlord only"}</span>
              </div>
            </div>

            {s.phone && <p className="mt-3 text-xs text-muted-foreground">{s.phone}</p>}
          </div>
        ))}

        {isLandlord && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-muted-foreground transition hover:border-brand-300 hover:text-brand-700"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold">Add a caretaker</span>
            <span className="text-xs">They'll only see this estate</span>
          </button>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add a caretaker</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="rounded-xl bg-brand-100/70 p-3 text-xs leading-relaxed text-brand-800">
              Caretakers sign in at <span className="font-semibold">/manager</span> with the username + temporary
              password you set here, and choose a new password on first login.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Username *</label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. grace" className="h-11 rounded-xl" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Full name *</label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Grace Mureithi" className="h-11 rounded-xl" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7xx xxx xxx" className="h-11 rounded-xl" inputMode="tel" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Temporary password *</label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 characters" className="h-11 rounded-xl" />
              </div>
            </div>
            <Button onClick={submitInvite} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
              <KeyRound className="h-4 w-4" /> {busy ? "Creating…" : "Create caretaker"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
