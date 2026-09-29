import { useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Trash2,
  Plus,
  UserRound,
  HeartPulse,
  Briefcase,
  Users,
  ShieldCheck,
} from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { saveOnboardingStep, completeOnboarding, type CoResident, type EmergencyContact } from "@/services/tenantPortal";

const STEPS = [
  { no: 1, label: "Personal contacts", icon: UserRound },
  { no: 2, label: "Status", icon: Briefcase },
  { no: 3, label: "Emergency contacts", icon: HeartPulse },
];

const MARITAL = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const OCCUPATION = [
  { value: "employed", label: "Employed" },
  { value: "student", label: "Student" },
  { value: "graduate", label: "Graduate (job hunting)" },
  { value: "other", label: "Other" },
];

const INCOME_BY_OCCUPATION: Record<string, { value: string; label: string }[]> = {
  employed: [
    { value: "salary", label: "Salary" },
    { value: "business", label: "Side business" },
    { value: "other", label: "Other" },
  ],
  student: [
    { value: "parental", label: "Parents / guardians" },
    { value: "side-hustle", label: "Side hustle" },
    { value: "other", label: "Other" },
  ],
  graduate: [
    { value: "savings", label: "Savings" },
    { value: "parental", label: "Parents / guardians" },
    { value: "side-hustle", label: "Side hustle" },
    { value: "other", label: "Other" },
  ],
  other: [
    { value: "business", label: "Business" },
    { value: "savings", label: "Savings" },
    { value: "parental", label: "Parents / guardians" },
    { value: "other", label: "Other" },
  ],
};

const STAY_OPTIONS = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "24", label: "2 years" },
  { value: "undecided", label: "Haven't thought about it yet" },
];

const RELATIONSHIPS = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "friend", label: "Friend" },
  { value: "spouse", label: "Spouse" },
  { value: "other", label: "Other" },
];

const COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Uasin Gishu", "Kiambu", "Machakos", "Kajiado",
  "Nyeri", "Meru", "Kakamega", "Kilifi", "Bungoma", "Kisii", "Trans Nzoia", "Other",
];

export default function TenantOnboarding() {
  const navigate = useNavigate();
  const { session, refreshTenantSession } = useAppSession();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1 — personal contacts
  const [fullNames, setFullNames] = useState(session?.kind === "tenant" ? session.tenant.fullName : "");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [residents, setResidents] = useState<CoResident[]>([]);

  // Step 2 — status
  const [maritalStatus, setMaritalStatus] = useState<string>("");
  const [familyMemberCount, setFamilyMemberCount] = useState("");
  const [occupation, setOccupation] = useState<string>("");
  const [incomeSource, setIncomeSource] = useState<string>("");
  const [stay, setStay] = useState<string>("");

  // Step 3 — emergency contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { name: "", relationship: "parent", phone: "", county: "" },
  ]);

  const incomeOptions = useMemo(() => INCOME_BY_OCCUPATION[occupation] ?? [], [occupation]);

  if (session?.kind !== "tenant") return <Navigate to="/tenant/access" replace />;
  // Temp password? The wizard waits until the tenant owns their password.
  if (session.mustChangePassword) return <Navigate to="/tenant/change-password" replace />;
  if (session.tenant.onboardingCompleted) return <Navigate to="/app" replace />;

  const tenantToken = session.token;

  const addResident = () => setResidents((r) => [...r, { fullName: "", phone: "" }]);
  const patchResident = (i: number, p: Partial<CoResident>) =>
    setResidents((r) => r.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  const addContact = () => setContacts((c) => [...c, { name: "", relationship: "friend", phone: "", county: "" }]);
  const patchContact = (i: number, p: Partial<EmergencyContact>) =>
    setContacts((c) => c.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  const step1Valid = fullNames.trim().length > 1 && phone.trim().length >= 9;
  const step2Valid = maritalStatus !== "" && occupation !== "" && incomeSource !== "";
  const step3Valid = contacts.some((c) => c.name.trim() && c.phone.trim());

  const persistStep = async (stepNo: 1 | 2 | 3, data: Parameters<typeof saveOnboardingStep>[2]) => {
    const { error } = await saveOnboardingStep(tenantToken, stepNo, data);
    if (error) throw new Error(error);
  };

  const handleNext = async () => {
    setBusy(true);
    try {
      if (step === 0) {
        if (!step1Valid) { toast.error("Full names and phone number are required."); return; }
        await persistStep(1, {
          fullNames: fullNames.trim(),
          phone: phone.trim(),
          idNumber: idNumber.trim() || undefined,
          residents: residents.filter((r) => r.fullName.trim()),
        });
      } else if (step === 1) {
        if (!step2Valid) { toast.error("Marital status, occupation and income source are required."); return; }
        await persistStep(2, {
          maritalStatus: maritalStatus as "single" | "married" | "prefer-not-to-say",
          familyMemberCount: maritalStatus === "married" && familyMemberCount ? Number(familyMemberCount) : undefined,
          occupation: occupation as "employed" | "student" | "graduate" | "other",
          incomeSource,
          intendedStayMonths: stay && stay !== "undecided" ? Number(stay) : undefined,
        });
      } else if (step === 2) {
        const cleaned = contacts
          .map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim(), county: c.county?.trim() || undefined }))
          .filter((c) => c.name && c.phone);
        if (cleaned.length < 1) { toast.error("Add at least one emergency contact."); return; }
        await persistStep(3, { contacts: cleaned });
        const { error } = await completeOnboarding(tenantToken);
        if (error) throw new Error(error);
        await refreshTenantSession();
        toast.success("You're all set — welcome home!");
        navigate("/app", { replace: true });
        return;
      }
      setStep((s) => Math.min(2, s + 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <Logo />
        <button onClick={goBack} disabled={step === 0 || busy}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-16">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Set up your stay</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
            Almost home, {fullNames.trim().split(" ")[0] || "neighbour"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Three quick steps so your caretaker knows who lives in the house and who to call.
          </p>
        </div>

        {/* Stepper */}
        <div className="mx-auto mt-8 flex max-w-lg items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.no} className="flex flex-1 items-center gap-2">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all",
                i < step ? "gradient-brand text-white" : i === step ? "border-2 border-brand-500 bg-brand-100 text-brand-700 shadow-brand" : "border border-border bg-card text-muted-foreground",
              )}>
                {i < step ? <Check className="h-4 w-4" /> : s.no}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-1 flex-1 rounded-full", i < step ? "gradient-brand" : "bg-border")} />}
            </div>
          ))}
        </div>

        {/* STEP 1 — Personal contacts */}
        {step === 0 && (
          <section className="mt-8 space-y-4 animate-fade-in" data-testid="onboarding-step-1">
            <div className="rounded-3xl border bg-card p-6 shadow-card">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white"><UserRound className="h-4 w-4" /></span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Personal contacts</h2>
                  <p className="text-xs text-muted-foreground">Who the caretaker should reach about this house.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <Field label="Full names *">
                  <Input value={fullNames} onChange={(e) => setFullNames(e.target.value)} placeholder="e.g. Jane Wanjiku" className="h-11 rounded-xl" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone number *">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7xx xxx xxx" inputMode="tel" className="h-11 rounded-xl" />
                  </Field>
                  <Field label="ID number">
                    <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="National ID" inputMode="numeric" className="h-11 rounded-xl" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Users className="h-4 w-4" /></span>
                  <div>
                    <h2 className="font-display text-[15px] font-semibold text-foreground">Others living with you</h2>
                    <p className="text-xs text-muted-foreground">
                      {residents.length === 0 ? "Just you" : `You + ${residents.length} other${residents.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {residents.map((r, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input value={r.fullName} onChange={(e) => patchResident(i, { fullName: e.target.value })} placeholder="Full name" className="h-11 rounded-xl" />
                    <Input value={r.phone} onChange={(e) => patchResident(i, { phone: e.target.value })} placeholder="Phone" inputMode="tel" className="h-11 rounded-xl" />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl text-rose-600 hover:bg-rose-50" onClick={() => setResidents((list) => list.filter((_, idx) => idx !== i))} aria-label={`Remove resident ${i + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <button onClick={addResident} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:border-brand-300 hover:text-brand-700">
                  <Plus className="h-4 w-4" /> Add another person
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 2 — Status */}
        {step === 1 && (
          <section className="mt-8 space-y-4 animate-fade-in" data-testid="onboarding-step-2">
            <div className="rounded-3xl border bg-card p-6 shadow-card">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white"><Briefcase className="h-4 w-4" /></span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Your status</h2>
                  <p className="text-xs text-muted-foreground">Helps the landlord plan renewals and follow-ups.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Marital status *">
                  <Select value={maritalStatus} onValueChange={(v) => { setMaritalStatus(v); if (v !== "married") setFamilyMemberCount(""); }}>
                    <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {MARITAL.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {maritalStatus === "married" && (
                  <Field label="Family members staying with you *">
                    <Input type="number" min={1} value={familyMemberCount} onChange={(e) => setFamilyMemberCount(e.target.value)} placeholder="e.g. 3" className="h-11 rounded-xl" inputMode="numeric" />
                  </Field>
                )}
                <Field label="Occupation *">
                  <Select value={occupation} onValueChange={(v) => { setOccupation(v); setIncomeSource(""); }}>
                    <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Select occupation" /></SelectTrigger>
                    <SelectContent>
                      {OCCUPATION.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Source of income (for rent) *">
                  <Select value={incomeSource} onValueChange={setIncomeSource} disabled={!occupation}>
                    <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder={occupation ? "Select source" : "Choose occupation first"} /></SelectTrigger>
                    <SelectContent>
                      {incomeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="How long do you plan to stay?" className="sm:col-span-2">
                  <Select value={stay} onValueChange={setStay}>
                    <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Select duration" /></SelectTrigger>
                    <SelectContent>
                      {STAY_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </section>
        )}

        {/* STEP 3 — Emergency contacts */}
        {step === 2 && (
          <section className="mt-8 space-y-4 animate-fade-in" data-testid="onboarding-step-3">
            <div className="rounded-3xl border bg-card p-6 shadow-card">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white"><HeartPulse className="h-4 w-4" /></span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Emergency contacts</h2>
                  <p className="text-xs text-muted-foreground">At least one person we can reach in case of emergency.</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {contacts.map((c, i) => (
                  <div key={i} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact {i + 1}</p>
                      {contacts.length > 1 && (
                        <button onClick={() => setContacts((list) => list.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove contact ${i + 1}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Full name *">
                        <Input value={c.name} onChange={(e) => patchContact(i, { name: e.target.value })} placeholder="e.g. Mary Wanjiku" className="h-11 rounded-xl" />
                      </Field>
                      <Field label="Relationship *">
                        <Select value={c.relationship} onValueChange={(v) => patchContact(i, { relationship: v })}>
                          <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Phone *">
                        <Input value={c.phone} onChange={(e) => patchContact(i, { phone: e.target.value })} placeholder="+254 7xx xxx xxx" inputMode="tel" className="h-11 rounded-xl" />
                      </Field>
                      <Field label="County of residence">
                        <Select value={c.county ?? ""} onValueChange={(v) => patchContact(i, { county: v })}>
                          <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Select county" /></SelectTrigger>
                          <SelectContent>
                            {COUNTIES.map((county) => <SelectItem key={county} value={county}>{county}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                ))}
                <button onClick={addContact} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:border-brand-300 hover:text-brand-700">
                  <Plus className="h-4 w-4" /> Add another contact
                </button>
              </div>
            </div>

            <Button onClick={handleNext} disabled={busy || !step3Valid} className="h-12 w-full gap-2 rounded-xl">
              <ShieldCheck className="h-4 w-4" /> {busy ? "Saving…" : "Finish setup"}
            </Button>
          </section>
        )}

        {step < 2 && (
          <Button onClick={handleNext} disabled={busy} className="mt-4 h-12 w-full gap-2 rounded-xl">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </main>

      <footer className="pb-8 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <LogoMark className="h-3.5 w-3.5 rounded" /> Your details are only visible to the landlord and caretaker.
        </p>
      </footer>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
