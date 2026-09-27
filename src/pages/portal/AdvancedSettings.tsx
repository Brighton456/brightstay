import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert, ShieldCheck, SunMoon, Lock, Save, Banknote, Smartphone,
  ScrollText, Users, Phone, ChevronLeft, TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useStaffData } from "@/hooks/useStaffData";
import { staffSaveSettings } from "@/services/staffAuth";
import { ACCENTS, MODES, type Accent, type Mode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SectionHeading } from "@/components/app/SectionHeading";
import { StatusBadge } from "@/components/app/StatusBadge";
import { toast } from "sonner";

interface PlatformSettings {
  rentDueDay: number;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  allowPartialPayments: boolean;
  brightpayEnabled: boolean;
  brightpayMinAmount: number;
  contactPhone: string;
  contactEmail: string;
  rulesText: string;
}

const DEFAULTS: PlatformSettings = {
  rentDueDay: 5,
  lateFeeEnabled: false,
  lateFeeAmount: 500,
  allowPartialPayments: true,
  brightpayEnabled: true,
  brightpayMinAmount: 50,
  contactPhone: "",
  contactEmail: "",
  rulesText: "",
};

export default function PortalAdvancedSettings() {
  const { role } = useAuth();
  const { accent, setAccent, mode, setMode, supportsMode: modeUnlocked } = useTheme();
  const { data, token, refresh } = useStaffData();
  const [confirmed, setConfirmed] = useState(false);
  const [platform, setPlatform] = useState<PlatformSettings>(() => {
    const s = (data?.settings ?? {}) as Record<string, unknown>;
    const p = (s.platform ?? {}) as Partial<PlatformSettings>;
    return { ...DEFAULTS, ...p };
  });
  const [canAllocate, setCanAllocate] = useState<boolean>(
    () => ((data?.settings ?? {}) as Record<string, unknown>).staffPermissions !== undefined
      ? (((data?.settings ?? {}) as Record<string, unknown>).staffPermissions as { canAllocate?: boolean }).canAllocate ?? true
      : true,
  );
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const isLandlord = role === "landlord";

  // Hydrate from the server once staff_overview arrives (unless already edited).
  useEffect(() => {
    if (dirtyRef.current || !data?.settings) return;
    const s = data.settings as Record<string, unknown>;
    const p = (s.platform ?? {}) as Partial<PlatformSettings>;
    setPlatform({ ...DEFAULTS, ...p });
    if (s.staffPermissions && typeof s.staffPermissions === "object") {
      setCanAllocate((s.staffPermissions as { canAllocate?: boolean }).canAllocate ?? true);
    }
  }, [data?.settings]);

  const savePlatform = async (patch: Partial<Record<string, unknown>>) => {
    if (!token) return toast.error("Session expired — sign in again.");
    setSaving(true);
    const res = await staffSaveSettings(token, patch);
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success("Platform settings saved");
    refresh();
  };

  const savePlatformSection = (section: Partial<PlatformSettings>) => {
    dirtyRef.current = true;
    const next = { ...platform, ...section };
    setPlatform(next);
    void savePlatform({ platform: next });
  };

  const saveCanAllocate = (v: boolean) => {
    dirtyRef.current = true;
    setCanAllocate(v);
    void savePlatform({ staffPermissions: { canAllocate: v } });
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <Link to="/portal/settings" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Back to settings
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Advanced Configuration</h1>
          <StatusBadge tone="success">Unlocked</StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          Operational controls that affect every tenant, caretaker and the portal itself.
        </p>
      </div>

      {isLandlord && !confirmed ? (
        <div className="overflow-hidden rounded-3xl border border-rose-200 bg-card shadow-card">
          <div className="border-b border-rose-100 bg-rose-50/70 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-brand">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-rose-800">You're signed in as landlord</p>
                <p className="text-xs text-rose-600">These controls apply instantly across the whole estate.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Platform rules, payment behaviour, staff permissions and the estate theme all apply globally the moment
              you change them. Confirm below to proceed — once changed, they affect all tenants and staff.
            </p>
            <Button onClick={() => setConfirmed(true)} className="h-12 w-full gap-2 rounded-xl">
              <ShieldCheck className="h-4 w-4" /> I understand — show controls
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Platform rules & payment behaviour (landlord-only, server-persisted) ── */}
          {isLandlord && (
            <>
              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-brand-600" />
                  <SectionHeading eyebrow="Rent & payments" title="Collection rules" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stored on the server — drives the rent tracker, dues and the tenant app.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Rent due day (of month)</label>
                    <Input
                      type="number" min={1} max={28} value={platform.rentDueDay}
                      onChange={(e) => setPlatform({ ...platform, rentDueDay: Math.max(1, Math.min(28, Number(e.target.value) || 1)) })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Late fee amount (KES)</label>
                    <Input
                      type="number" min={0} value={platform.lateFeeAmount}
                      onChange={(e) => setPlatform({ ...platform, lateFeeAmount: Math.max(0, Number(e.target.value) || 0) })}
                      className="h-11 rounded-xl"
                      disabled={!platform.lateFeeEnabled}
                    />
                  </div>
                </div>
                <div className="mt-4 divide-y divide-border/60">
                  <ToggleRow
                    label="Charge late fee on overdue months"
                    desc={`Adds ${platform.lateFeeAmount > 0 ? `KES ${platform.lateFeeAmount.toLocaleString()}` : "a fee"} to unpaid months after the due day`}
                    on={platform.lateFeeEnabled}
                    onChange={(v) => savePlatformSection({ lateFeeEnabled: v, lateFeeAmount: platform.lateFeeAmount })}
                  />
                  <ToggleRow
                    label="Allow partial rent payments"
                    desc="Tenants can pay any amount; it credits their oldest unpaid month"
                    on={platform.allowPartialPayments}
                    onChange={(v) => savePlatformSection({ allowPartialPayments: v })}
                  />
                </div>
                <Button className="mt-4 gap-2 rounded-xl" disabled={saving} onClick={() => savePlatformSection({})}>
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save rent rules"}
                </Button>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-brand-600" />
                  <SectionHeading eyebrow="BrightPay" title="On-platform M-Pesa" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tenants pay rent from their dashboard; system payments confirm automatically on your records.
                </p>
                <div className="mt-4 divide-y divide-border/60">
                  <ToggleRow
                    label="Enable BrightPay payments"
                    desc="Shows the “Pay rent” button in the tenant app"
                    on={platform.brightpayEnabled}
                    onChange={(v) => savePlatformSection({ brightpayEnabled: v })}
                  />
                </div>
                <div className="mt-4 max-w-[220px]">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Minimum payment (KES)</label>
                  <Input
                    type="number" min={1} value={platform.brightpayMinAmount}
                    onChange={(e) => setPlatform({ ...platform, brightpayMinAmount: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button className="mt-4 gap-2 rounded-xl" disabled={saving} onClick={() => savePlatformSection({})}>
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save BrightPay settings"}
                </Button>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-600" />
                  <SectionHeading eyebrow="Staff" title="Caretaker permissions" />
                </div>
                <div className="mt-4 divide-y divide-border/60">
                  <ToggleRow
                    label="Caretakers can allocate vacant units"
                    desc="When off, only you can allocate houses and issue access codes"
                    on={canAllocate}
                    onChange={saveCanAllocate}
                  />
                </div>
                {!canAllocate && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Caretakers can still record payments and manage maintenance requests, but allocation is landlord-only.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-brand-600" />
                  <SectionHeading eyebrow="Estate" title="Property contact & rules" />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contact phone</label>
                    <Input value={platform.contactPhone} onChange={(e) => setPlatform({ ...platform, contactPhone: e.target.value })} className="h-11 rounded-xl" placeholder="+254…" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contact email</label>
                    <Input value={platform.contactEmail} onChange={(e) => setPlatform({ ...platform, contactEmail: e.target.value })} className="h-11 rounded-xl" placeholder="care@…" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">House rules & notices (shown to tenants)</label>
                  <Textarea rows={4} value={platform.rulesText} onChange={(e) => setPlatform({ ...platform, rulesText: e.target.value })} className="rounded-xl" placeholder="e.g. Quiet hours 10pm–6am. Garbage collection on Tuesdays…" />
                </div>
                <Button className="mt-4 gap-2 rounded-xl" disabled={saving} onClick={() => savePlatformSection({})}>
                  <ScrollText className="h-4 w-4" /> {saving ? "Saving…" : "Save estate details"}
                </Button>
              </div>
            </>
          )}

          {/* ── Theme (existing controls) ── */}
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <SectionHeading eyebrow="Brand" title="Primary brand color" />
            <p className="mt-1 text-xs text-muted-foreground">Applied instantly across the whole site.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {ACCENTS.map((t) => {
                const active = accent === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      setAccent(t.value as Accent);
                      toast.success(`${t.label} theme applied`);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-2.5 rounded-2xl border bg-background/50 p-3.5 text-left transition-all hover:-translate-y-0.5",
                      active ? "border-brand-500/60 ring-2 ring-brand-500/40" : "border-border hover:border-border/60"
                    )}
                  >
                    <span className="h-11 w-full rounded-xl shadow-card" style={{ background: t.swatch }} />
                    <span className={cn("text-sm font-semibold", active ? "text-brand-700" : "text-foreground")}>{t.label}</span>
                    <span className="text-[11px] text-muted-foreground">{active ? "Active" : "Apply"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionHeading eyebrow="Appearance" title="Display mode" />
                <p className="mt-1 text-xs text-muted-foreground">
                  White (light) or Black (dark) surface across the estate.
                </p>
              </div>
              <StatusBadge tone={modeUnlocked ? "success" : "warning"}>
                {modeUnlocked ? "Unlocked by brand" : "Locked"}
              </StatusBadge>
            </div>

            {modeUnlocked ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {MODES.map((m) => {
                  const active = mode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => {
                        setMode(m.value as Mode);
                        toast.success(`${m.label} mode applied`);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
                        active ? "border-brand-500/60 ring-2 ring-brand-500/40" : "border-border hover:border-border/60"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-card",
                          m.value === "light" ? "bg-white text-stone-700" : "bg-stone-900 text-stone-100"
                        )}
                      >
                        <SunMoon className="h-5 w-5" />
                      </span>
                      <span>
                        <p className={cn("text-sm font-semibold", active ? "text-brand-700" : "text-foreground")}>{m.label}</p>
                        <p className="text-[11px] text-muted-foreground">{m.hint}</p>
                      </span>
                      {active && (
                        <span className="ml-auto rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  White / Black mode unlocks once a primary brand color is set (Crimson, Golden or Forest). Choose a brand
                  color above and the appearance switcher appears.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmed(false)} className="flex-1 rounded-xl">
              Re-confirm gate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={on} onCheckedChange={onChange} />
    </div>
  );
}
