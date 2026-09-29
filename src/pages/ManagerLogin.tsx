import { useEffect, useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import {
  Lock, UserRound, ArrowRight, ShieldCheck, Building2, Phone, Eye, EyeOff,
} from "lucide-react";
import { staffHasLandlord, staffCreateProperty } from "@/services/staffAuth";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

/**
 * /manager — landlord + caretaker gate.
 *
 * Labels never say "Manager": this is the Landlord portal. The landlord signs
 * in (or, on first run only, creates the landlord account and registers their
 * apartment). This route is deliberately unadvertised — everyone else signs in
 * at /auth. Accounts are always issued by the landlord, never self-created
 * here except for that first-run landlord.
 */
export function ManagerAuthScreen({ initialMode = "signin" }: { initialMode?: "signin" | "register" }) {
  const navigate = useNavigate();
  const { session, signInStaff, signUpLandlord, refreshStaffSession } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">(initialMode);
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Sign-in fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // First-run registration fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [propertyLocation, setPropertyLocation] = useState("");

  // Is the first-run landlord signup still open?
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    staffHasLandlord().then((has) => {
      if (cancelled) return;
      setFirstRun(!has);
      if (!has) setMode("register");
    }).catch(() => !cancelled && setFirstRun(false));
    return () => { cancelled = true; };
  }, []);

  if (session?.kind === "staff") {
    if (session.mustChangePassword) return <Navigate to="/manager/change-password" replace />;
    // Signed-in landlord who hasn't registered an apartment yet → finish setup.
    if (session.user.role === "landlord" && !session.user.propertyId) {
      return <ApartmentRegistration />;
    }
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

  const handleRegister = async () => {
    if (!isSupabaseConfigured) return toast.info("Supabase is not configured.");
    if (fullName.trim().length < 2) return toast.error("Enter your full name.");
    if (!/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase())) {
      return toast.error("Username: 3–32 characters — letters, numbers, dots, dashes or underscores.");
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return toast.error("Password: at least 8 characters with letters and numbers.");
    }
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    if (propertyName.trim().length < 2) return toast.error("Name your apartment to continue.");

    setBusy(true);
    const created = await signUpLandlord({
      username: username.trim().toLowerCase(),
      password: newPassword,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    });
    if (created.error || !created.token) {
      setBusy(false);
      // If a landlord already exists, the signup window is closed — sign in instead.
      if (created.error?.toLowerCase().includes("already exists")) {
        setFirstRun(false);
        setMode("signin");
      }
      return toast.error(created.error ?? "Could not create the account.");
    }
    const res = await staffCreateProperty(
      created.token,
      propertyName.trim(),
      propertyLocation.trim() || undefined,
    );
    await refreshStaffSession();
    setBusy(false);
    if (res.error) {
      toast.warning(`Account created, but the apartment could not be registered: ${res.error}`);
    } else {
      toast.success(`Welcome, ${fullName.trim().split(" ")[0]} — ${propertyName.trim()} is ready`);
    }
    navigate("/portal", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 left-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Landlord portal</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
            {mode === "register" ? <>Create your <span className="text-gradient-brand">landlord</span> account</> : <>Landlord <span className="text-gradient-brand">sign in</span></>}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {mode === "register"
              ? "First run: create the landlord account and register your apartment. Team accounts are added from the portal."
              : "Sign in with your landlord account."}
          </p>
        </div>

        {mode === "signin" ? (
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
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="h-12 rounded-xl pl-10 pr-10"
                  autoComplete="current-password"
                  data-testid="manager-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={handleSignIn} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
                {busy ? "Signing in…" : <>Sign in to your portal <ArrowRight className="h-4 w-4" /></>}
              </Button>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Accounts are issued by the landlord — there is no public signup.
              </p>
              {firstRun === false && (
                <button
                  onClick={() => setMode("register")}
                  className="w-full text-center text-xs font-semibold text-brand-700 transition hover:underline"
                >
                  First time here? Create the landlord account
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" /> Landlord account
              </p>
              <div className="mt-3 grid gap-3">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="h-12 rounded-xl" autoComplete="name" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="h-12 rounded-xl" autoComplete="username" data-testid="manager-username" />
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" inputMode="tel" className="h-12 rounded-xl pl-10" />
                  </div>
                </div>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (8+ chars, letters & numbers)"
                  className="h-12 rounded-xl"
                  autoComplete="new-password"
                />
                <Input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Confirm password"
                  className="h-12 rounded-xl"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Your apartment
              </p>
              <div className="mt-3 grid gap-3">
                <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="Apartment name — e.g. Baraka Court" className="h-12 rounded-xl" />
                <Input value={propertyLocation} onChange={(e) => setPropertyLocation(e.target.value)} placeholder="Location (optional) — e.g. Kilimani, Nairobi" className="h-12 rounded-xl" />
              </div>
            </div>

            <Button onClick={handleRegister} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
              {busy ? "Setting up…" : <>Create account & register apartment <ArrowRight className="h-4 w-4" /></>}
            </Button>
            {firstRun === false && (
              <button
                onClick={() => setMode("signin")}
                className="w-full text-center text-xs font-semibold text-muted-foreground transition hover:text-foreground"
              >
                A landlord account already exists — sign in instead
              </button>
            )}
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> BrightStay · Landlord portal
        </p>
      </main>
    </div>
  );
}

export default function ManagerLogin() {
  return <ManagerAuthScreen initialMode="signin" />;
}

/** Signed-in landlord finishing setup: register the apartment only. */
export function ApartmentRegistration() {
  const navigate = useNavigate();
  const { session, refreshStaffSession } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [propertyName, setPropertyName] = useState("");
  const [propertyLocation, setPropertyLocation] = useState("");

  if (session?.kind !== "staff") return <Navigate to="/manager" replace />;

  const submit = async () => {
    if (propertyName.trim().length < 2) return toast.error("Name your apartment to continue.");
    setBusy(true);
    const res = await staffCreateProperty(
      session.token,
      propertyName.trim(),
      propertyLocation.trim() || undefined,
    );
    await refreshStaffSession();
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${propertyName.trim()} is ready`);
    navigate("/portal", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 left-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl" aria-hidden />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-6">
        <div className="text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Building2 className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
            Register your <span className="text-gradient-brand">apartment</span>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            One last step — name your apartment so you can add units and tenants.
          </p>
        </div>
        <div className="mt-8 space-y-3 rounded-2xl border bg-card/80 p-6 shadow-card backdrop-blur">
          <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="Apartment name — e.g. Baraka Court" className="h-12 rounded-xl" autoFocus />
          <Input value={propertyLocation} onChange={(e) => setPropertyLocation(e.target.value)} placeholder="Location (optional) — e.g. Kilimani, Nairobi" className="h-12 rounded-xl" />
          <Button onClick={submit} disabled={busy} className="h-12 w-full gap-2 rounded-xl">
            {busy ? "Registering…" : <>Register apartment <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </main>
    </div>
  );
}
