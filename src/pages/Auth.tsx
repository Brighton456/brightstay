import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Lock, UserRound, ArrowRight, KeyRound, ShieldCheck, Building2 } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

/**
 * /auth — the shared login page.
 *
 *  • Tenants log in with the 6-digit access code their caretaker gave them
 *    (login-only — tenants can NEVER sign up).
 *  • Caretakers sign in with the username + password the landlord issued.
 *  • Landlords use the discreet /manager route instead (no advert here).
 */
export default function Auth() {
  const navigate = useNavigate();
  const { session, signInStaff, claimTenant } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [pane, setPane] = useState<"tenant" | "caretaker">("tenant");

  // Tenant
  const [code, setCode] = useState("");
  // Caretaker
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (session?.kind === "tenant") {
    return <Navigate to={session.tenant.onboardingCompleted ? "/app" : "/tenant/onboarding"} replace />;
  }
  if (session?.kind === "staff") {
    return <Navigate to={session.mustChangePassword ? "/manager/change-password" : "/portal"} replace />;
  }

  const handleCode = async () => {
    if (!isSupabaseConfigured) return toast.info("Supabase is not configured.");
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code from your caretaker.");
    setBusy(true);
    const { error } = await claimTenant(code);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Code accepted — let's set up your stay");
    navigate("/tenant/onboarding", { replace: true });
  };

  const handleSignIn = async () => {
    if (!isSupabaseConfigured) return toast.info("Supabase is not configured.");
    if (!username.trim() || !password) return toast.error("Enter your username and password.");
    setBusy(true);
    const { error, mustChangePassword } = await signInStaff(username.trim(), password);
    setBusy(false);
    if (error) return toast.error(error);
    if (mustChangePassword) {
      toast.info("First login — set a new password to continue.");
      navigate("/manager/change-password", { replace: true });
      return;
    }
    toast.success("Welcome back");
    navigate("/portal", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <Link
          to="/manager"
          className="text-xs font-semibold text-muted-foreground/70 transition hover:text-foreground"
          data-testid="landlord-link"
        >
          Landlord?
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Welcome home</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
            Your stay, <span className="text-gradient-brand">beautiful</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Tenants log in with an access code. Caretakers sign in below.
          </p>
        </div>

        {/* Tenant / Caretaker switch */}
        <div className="mx-auto mt-7 flex w-full max-w-xs rounded-full border border-border/60 bg-card p-1 shadow-card" role="tablist" aria-label="Choose login type">
          {(
            [
              { id: "tenant", label: "I'm a tenant", icon: KeyRound },
              { id: "caretaker", label: "I'm a caretaker", icon: Building2 },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-all",
                pane === id ? "bg-brand-100/90 text-brand-800 shadow-sm" : "text-stone-500 hover:text-foreground",
              )}
              data-testid={`auth-tab-${id}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {pane === "tenant" ? (
          <div className="mt-5 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur" data-testid="tenant-code-card">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-[15px] font-semibold text-foreground">Log in with your access code</p>
                <p className="text-xs text-muted-foreground">The 6-digit code from your caretaker. No signup needed.</p>
              </div>
            </div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              inputMode="numeric"
              className="mt-4 h-14 rounded-xl text-center font-display text-2xl tracking-[0.55em]"
              autoFocus
              data-testid="access-code-input"
              aria-label="6-digit access code"
            />
            <Button onClick={handleCode} disabled={busy || code.length !== 6} className="mt-3 h-12 w-full gap-2 rounded-xl">
              {busy ? "Checking…" : <>Unlock my stay <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <button
              onClick={() => navigate("/tenant/access")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300/70 bg-brand-50/60 px-4 py-3.5 text-sm font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-100/60"
              data-testid="access-code-quiz"
            >
              <KeyRound className="h-4 w-4" />
              New tenant? Click here to log in with your access code
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur" data-testid="caretaker-card">
            <div className="space-y-3">
              <div className="relative">
                <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="h-12 rounded-xl pl-10"
                  autoComplete="username"
                  data-testid="caretaker-username"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Password"
                  className="h-12 rounded-xl pl-10"
                  autoComplete="current-password"
                  data-testid="caretaker-password"
                />
              </div>
              <Button onClick={handleSignIn} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
                {busy ? "Signing in…" : <>Sign in to your portal <ArrowRight className="h-4 w-4" /></>}
              </Button>
              <p className="pt-1 text-center text-[11px] text-muted-foreground">
                Caretaker accounts are issued by the landlord — no signup.
              </p>
            </div>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> BrightStay · Your stay, handled
        </p>
      </main>
    </div>
  );
}
