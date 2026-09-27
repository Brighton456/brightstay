import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useStaffData } from "@/hooks/useStaffData";
import { staffUpdateProfile } from "@/services/staffAuth";
import { SectionHeading } from "@/components/app/SectionHeading";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronRight, LockKeyhole, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";

export default function PortalSettings() {
  const { user, role, signOut } = useAuth();
  const { session } = useAppSession();
  const { data, refresh } = useStaffData();
  const token = session?.kind === "staff" ? session.token : null;
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const openEditor = () => {
    setFullName(user?.name ?? "");
    setPhone(data?.staff.find((m) => m.id === user?.id)?.phone ?? "");
    setEditOpen(true);
  };

  const saveProfile = async () => {
    if (!token) return toast.error("Session expired — sign in again.");
    if (fullName.trim().length < 2) return toast.error("Please enter your full name.");
    setBusy(true);
    const res = await staffUpdateProfile(token, fullName.trim(), phone.trim() || undefined);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Profile updated");
    setEditOpen(false);
    await refresh();
    window.location.reload(); // refresh the header identity everywhere
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace, account and notification preferences</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <SectionHeading eyebrow="Profile" title="Account" />
        <div className="mt-4 flex items-center gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand font-display text-lg font-semibold text-white">
            {user?.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground capitalize">{role}</p>
          </div>
          <StatusBadge tone="success" className="ml-auto">Connected</StatusBadge>
        </div>
        <Button variant="outline" className="mt-5 rounded-xl" onClick={openEditor}>
          <UserRound className="h-4 w-4" /> Edit profile
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <SectionHeading eyebrow="Workspace" title="Notifications" />
        <p className="mt-1 text-xs text-muted-foreground">
          Preferences for this device — delivery channels arrive with the notification service.
        </p>
        <div className="mt-4 divide-y divide-border/60">
          {[
            { t: "New M-Pesa payments", d: "Alert when a tenant pays", on: true },
            { t: "Maintenance escalations", d: "Urgent requests ping you", on: true },
            { t: "Weekly collection digest", d: "Every Monday, landlord only", on: role === "landlord" },
            { t: "Low occupancy warnings", d: "When vacancy crosses 20%", on: role === "landlord" },
          ].map(({ t, d, on }, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <p className="text-sm font-medium text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
              <Switch defaultChecked={on} onCheckedChange={() => toast.success("Preference saved on this device")} />
            </div>
          ))}
        </div>
      </div>

      {role === "landlord" && (
        <div className="rounded-2xl border border-rose-200/60 bg-card p-5 shadow-card">
          <SectionHeading eyebrow="Restricted" title="Advanced Configuration" />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Platform rules, payment behaviour, staff permissions and theme — all server-persisted and landlord-only.
          </p>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>These settings apply globally and are restricted to the landlord role.</p>
          </div>
          <Link to="/portal/settings/advanced">
            <Button variant="outline" className="mt-4 w-full gap-2 rounded-xl">
              <LockKeyhole className="h-4 w-4" /> Open advanced configuration <ChevronRight className="ml-auto h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        onClick={() => signOut()}
      >
        Sign out
      </Button>

      {/* Profile editor */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Edit profile</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Full name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl" placeholder="Jane Wanjiku" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" placeholder="+254 7…" />
            </div>
            <Button className="h-12 w-full rounded-xl" disabled={busy} onClick={saveProfile}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Username and password are managed from sign-in security.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
