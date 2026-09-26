import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * /tenant/access — opened from the quiz on /auth.
 * New tenant types the 6-digit access code, then is guided into onboarding.
 */
export default function TenantAccess() {
  const navigate = useNavigate();
  const { session, claimTenant } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  if (session?.kind === "tenant") {
    return <Navigate to={session.tenant.onboardingCompleted ? "/app" : "/tenant/onboarding"} replace />;
  }

  const handleVerify = async () => {
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
        <Link to="/auth" className="text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          Back to sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
            Welcome, <span className="text-gradient-brand">new tenant</span>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Type the 6-digit access code your caretaker gave you to set up your stay.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur" data-testid="access-code-panel">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            inputMode="numeric"
            className="h-14 rounded-xl text-center font-display text-2xl tracking-[0.55em]"
            autoFocus
            data-testid="access-code-input"
            aria-label="6-digit access code"
          />
          <Button
            onClick={handleVerify}
            disabled={busy || code.length !== 6}
            className="mt-3 h-12 w-full gap-2 rounded-xl"
          >
            {busy ? "Checking…" : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Codes are single-use and expire after 30 days.
          </p>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> BrightStay
        </p>
      </main>
    </div>
  );
}
