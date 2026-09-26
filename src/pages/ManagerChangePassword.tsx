import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffChangePassword } from "@/services/staffAuth";
import { toast } from "sonner";

/** First-login password change for staff (must_change_password flag). */
export default function ManagerChangePassword() {
  const navigate = useNavigate();
  const { session, signOut, clearMustChangePassword } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (session?.kind !== "staff") return <Navigate to="/manager" replace />;

  const handleSubmit = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const { error } = await staffChangePassword(session.token, password);
    setBusy(false);
    if (error) return toast.error(error);
    clearMustChangePassword();
    toast.success("Password updated — welcome to your portal");
    navigate("/portal", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 py-5"><Logo /></header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">Set your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            For security, choose a new password before using the portal. Minimum 8 characters.
          </p>
        </div>
        <div className="mt-8 space-y-3 rounded-2xl border bg-card p-6 shadow-card">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="h-12 rounded-xl"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="h-12 rounded-xl"
            autoComplete="new-password"
          />
          <Button onClick={handleSubmit} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
            <ShieldCheck className="h-4 w-4" /> {busy ? "Saving…" : "Save and continue"}
          </Button>
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
