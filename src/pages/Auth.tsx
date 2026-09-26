import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

/**
 * Tenant login — login-only (NO signup).
 * Beautiful login card + the access-code quiz at the bottom:
 *   "New tenant? Click here to log in with your access code."
 */
export default function Auth() {
  const navigate = useNavigate();
  const { session, signInStaff, claimTenant } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"quiz" | "code">("quiz");

  if (session?.kind === "tenant") {
    return <Navigate to={session.tenant.onboardingCompleted ? "/app" : "/tenant/onboarding"} replace />;
  }

  const handleSignIn = async () => {
    if (!isSupabaseConfigured) return toast.info("Supabase is not configured.");
    if (!email.trim() || !password) return toast.error("Enter your email and password.");
    setBusy(true);
    const { error } = await signInStaff(email.trim(), password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Welcome back");
    navigate("/manager", { replace: true });
  };

  const handleCode = async () => {
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code from your caretaker.");
    setBusy(true);
    const { error } = await claimTenant(code);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Code accepted — let's set up your stay");
    navigate("/tenant/onboarding", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Welcome home</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
            Your stay, <span className="text-gradient-brand">beautiful</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Sign in to see your rent, payments and your new home.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur">
          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-xl pl-10"
                autoComplete="email"
                data-testid="tenant-email"
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
                data-testid="tenant-password"
              />
            </div>
            <Button onClick={handleSignIn} disabled={busy} className="h-12 w-full rounded-xl">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Tenants sign in with credentials from their caretaker. No signup needed.
            </p>
          </div>
        </div>

        {/* Access-code quiz */}
        {mode === "quiz" ? (
          <button
            onClick={() => setMode("code")}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300/70 bg-brand-50/60 px-4 py-4 text-sm font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-100/60"
          >
            <KeyRound className="h-4 w-4" />
            New tenant? Click here to log in with your access code
          </button>
        ) : (
          <div className="mt-5 rounded-2xl border bg-card p-5 shadow-card" data-testid="access-code-panel">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-[15px] font-semibold text-foreground">Enter your access code</p>
                <p className="text-xs text-muted-foreground">The 6-digit code your caretaker gave you.</p>
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
            />
            <Button onClick={handleCode} disabled={busy || code.length !== 6} className="mt-3 h-12 w-full gap-2 rounded-xl">
              Unlock my stay <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              onClick={() => { setMode("quiz"); setCode(""); }}
              className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Back to sign in
            </button>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> BrightStay · Your stay, handled
        </p>
      </main>
    </div>
  );
}
