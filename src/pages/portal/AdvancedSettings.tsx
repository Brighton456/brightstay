import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ShieldCheck, SunMoon, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ACCENTS, MODES, supportsMode, type Accent, type Mode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/app/SectionHeading";
import { StatusBadge } from "@/components/app/StatusBadge";
import { toast } from "sonner";

export default function PortalAdvancedSettings() {
  const { role } = useAuth();
  const { accent, setAccent, mode, setMode, supportsMode: modeUnlocked } = useTheme();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <Link to="/portal/settings" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Advanced Configuration</h1>
          <StatusBadge tone="success">Unlocked</StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          Operational controls that affect every tenant, caretaker and the portal itself.
        </p>
      </div>

      {role === "landlord" && !confirmed ? (
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
              Theme, brand color and display mode are applied globally the moment you change them. Confirm below to
              proceed — once changed, they affect all tenants and staff.
            </p>
            <Button onClick={() => setConfirmed(true)} className="h-12 w-full gap-2 rounded-xl">
              <ShieldCheck className="h-4 w-4" /> I understand — show controls
            </Button>
          </div>
        </div>
      ) : (
        <>
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