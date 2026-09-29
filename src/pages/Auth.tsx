import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Lock, UserRound, ArrowRight, ShieldCheck, Phone } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

/**
 * /auth — one sign-in screen for everyone.
 *
 * Deliberately unlabelled: residents and staff both land here and the same
 * username/password form (or a 6-digit access code) gets them in. The portal
 * route is not advertised anywhere on this page.
 */
export default function Auth() {
  const navigate = useNavigate();
  const { session, signInStaff, claimTenant, loginTenant } = useAppSession();
  const [busy, setBusy] = useState(false);

  // Shared username/password form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // 6-digit access code
  const [code, setCode] = useState("");

  if (session?.kind === "tenant") {
    if (session.mustChangePassword) return <Navigate to="/tenant/change-password" replace />;
    return <Navigate to={session.tenant.onboardingCompleted ? "/app" : "/tenant/onboarding"} replace />;
  }
  if (session?.kind === "staff") {
    return <Navigate to={session.mustChangePassword ? "/manager/change-password" : "/portal"} replace />;
  }

  const handleCode = async () => {
    if (!isSupabaseConfigured) return toast.info("Supabase is not configured.");
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit access code you were given.");
    setBusy(true);
    const { error, mustChangePassword } = await claimTenant(code);
    setBusy(false);
    if (error) return toast.error(error);
    if (mustChangePassword) {
      toast.info("Almost there — choose your own password to continue.");
      navigate("/tenant/change-password", { replace: true });
      return;
    }
    toast.success("Code accepted — let's set up your stay");
    navigate("/tenant/onboarding", { replace: true });
  };

  /**
   * One form, two account tables. Staff accounts are tried first, then
   * tenant credentials, so nobody has to know which door they belong to.
   */
  const handleSignIn = async () => {
    if (!isSupabaseConfigured) return toast.info("Supabase is not configured.");
    const u = username.trim();
    if (!u || !password) return toast.error("Enter your username and password.");
    setBusy(true);
    const staffRes = await signInStaff(u, password);
    if (!staffRes.error) {
      setBusy(false);
      if (staffRes.mustChangePassword) {
        toast.info("First login — set a new password to continue.");
        navigate("/manager/change-password", { replace: true });
        return;
      }
      toast.success("Welcome back");
      navigate("/portal", { replace: true });
      return;
    }
    const tenantRes = await loginTenant(u, password);
    setBusy(false);
    if (!tenantRes.error) {
      if (tenantRes.mustChangePassword) {
        toast.info("First login — choose your own password to continue.");
        navigate("/tenant/change-password", { replace: true });
        return;
      }
      toast.success("Welcome back");
      navigate("/app", { replace: true });
      return;
    }
    // A lockout message is more useful than the generic rejection.
    const specific = [tenantRes.error, staffRes.error].find((e) => e && /lock/i.test(e));
    toast.error(specific ?? "Invalid username or password.");
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Welcome home</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
            Your stay, <span className="text-gradient-brand">beautiful</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Sign in to continue.
          </p>
        </div>

        <div className="mt-7 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur" data-testid="signin-card">
          <div className="space-y-3">
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                placeholder="Username"
                className="h-12 rounded-xl pl-10"
                autoComplete="username"
                data-testid="login-username"
                aria-label="Username"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                type="password"
                placeholder="Password"
                className="h-12 rounded-xl pl-10"
                autoComplete="current-password"
                data-testid="login-password"
                aria-label="Password"
              />
            </div>
            <Button
              onClick={handleSignIn}
              disabled={busy || !username.trim() || !password}
              className="h-12 w-full gap-2 rounded-xl"
              data-testid="login-submit"
            >
              {busy ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div data-testid="access-code-card">
            <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Log in with your access code
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The 6-digit code you were given. No signup needed.
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleCode()}
              placeholder="••••••"
              inputMode="numeric"
              className="mt-3 h-14 rounded-xl text-center font-display text-2xl tracking-[0.55em]"
              data-testid="access-code-input"
              aria-label="6-digit access code"
            />
            <Button
              onClick={handleCode}
              disabled={busy || code.length !== 6}
              variant="secondary"
              className="mt-3 h-12 w-full gap-2 rounded-xl"
            >
              {busy ? "Checking…" : <>Unlock my stay <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>

          <p className="mt-5 flex items-start gap-1.5 text-center text-[11px] leading-relaxed text-muted-foreground">
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
              Forgot your password? Ask the property office for a new one — passwords and codes are issued to you,
              never self-registered.
            </span>
          </p>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> BrightStay · Your stay, handled
        </p>
      </main>
    </div>
  );
}
