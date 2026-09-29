import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * /tenant/change-password
 *
 * Forced first-login flow: a tenant never keeps a password somebody else chose
 * for them, so a fresh tenant (access code or temp password) lands here before
 * the app opens. Also reachable voluntarily from the profile screen.
 */
export default function TenantChangePassword() {
  const navigate = useNavigate();
  const { session, signOut, changeTenantPassword } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (session?.kind !== "tenant") return <Navigate to="/auth" replace />;

  const forced = session.mustChangePassword;
  const destination = session.tenant.onboardingCompleted ? "/app" : "/tenant/onboarding";

  const handleSubmit = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return toast.error("Include at least one letter and one number.");
    }
    if (password !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const { error } = await changeTenantPassword(password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Password saved — you're all set");
    navigate(destination, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">
            {forced ? "Choose your password" : "Change your password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {forced
              ? "This is the first time you're signing in, so pick a password only you know. Minimum 8 characters, with a letter and a number."
              : "Pick something new. Minimum 8 characters, with a letter and a number."}
          </p>
        </div>
        <div className="mt-8 space-y-3 rounded-2xl border bg-card p-6 shadow-card" data-testid="tenant-change-password-card">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="h-12 rounded-xl pr-10"
              autoComplete="new-password"
              autoFocus
              data-testid="tenant-new-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Confirm new password"
            className="h-12 rounded-xl"
            autoComplete="new-password"
            data-testid="tenant-confirm-password"
          />
          <Button onClick={handleSubmit} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
            <ShieldCheck className="h-4 w-4" /> {busy ? "Saving…" : forced ? "Save and continue" : "Save password"}
          </Button>
          {!forced && (
            <Link
              to={destination}
              className="block w-full text-center text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Back without changing
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="w-full text-center text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Sign out instead
          </button>
        </div>
      </main>
    </div>
  );
}
