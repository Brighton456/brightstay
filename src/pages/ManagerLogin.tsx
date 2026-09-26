import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Lock, UserRound, ArrowRight, ShieldCheck } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

/**
 * /manager — landlord + caretaker login.
 * Table-based accounts (staff_accounts): username + password via RPC.
 */
export default function ManagerLogin() {
  const navigate = useNavigate();
  const { session, signInStaff } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (session?.kind === "staff") {
    return <Navigate to="/portal" replace />;
  }

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
    navigate("/portal", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 left-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <Link to="/auth" className="text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          I'm a tenant
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Staff portal</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
            Manager <span className="text-gradient-brand">sign in</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            For landlords and caretakers. Tenants sign in at{" "}
            <Link to="/auth" className="font-semibold text-brand-700 hover:underline">/auth</Link>.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur">
          <div className="space-y-3">
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="h-12 rounded-xl pl-10"
                autoComplete="username"
                data-testid="manager-username"
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
                data-testid="manager-password"
              />
            </div>
            <Button onClick={handleSignIn} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
              {busy ? "Signing in…" : <>Sign in to portal <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Accounts are issued by the landlord — no public signup.
            </p>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> BrightStay Manager
        </p>
      </main>
    </div>
  );
}
