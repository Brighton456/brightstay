import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, DoorOpen, Home, Pencil, ShieldCheck, Hammer, CheckCircle2, UserX,
  KeyRound, Plus, Copy, Check, Wallet, Landmark, Banknote, Smartphone, CircleEllipsis, UserRound,
} from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchStaffOverview, allocateUnit, staffAddUnit, type StaffOverview, type StaffUnit,
} from "@/services/staffAuth";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatKES } from "@/lib/format";

const UNIT_TYPES = ["Bedsitter", "Studio", "1-Bedroom", "2-Bedroom", "3-Bedroom", "4-Bedroom"];

const METHOD_ICON: Record<string, typeof Wallet> = {
  "M-Pesa": Smartphone,
  Cash: Banknote,
  Bank: Landmark,
  Card: Wallet,
  Other: CircleEllipsis,
};

const METHODS = ["M-Pesa", "Cash", "Bank", "Card", "Other"];

export default function PortalRooms() {
  const navigate = useNavigate();
  const { session } = useAppSession();
  const { role } = useAuth();
  const [data, setData] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState<StaffUnit | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);

  const staffToken = session?.kind === "staff" ? session.token : null;
  const isLandlord = role === "landlord";

  const refresh = async () => {
    if (!staffToken) return;
    setLoading(true);
    const res = await fetchStaffOverview(staffToken);
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffToken]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!staffToken) return <NavigateToLogin />;

  const units = data?.units ?? [];
  const propertyName = data?.property?.name ?? "your property";
  const vacant = units.filter((u) => u.status === "vacant");
  const occupied = units.filter((u) => u.status === "occupied");
  const maintenance = units.filter((u) => u.status === "maintenance");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Rooms</h1>
          <p className="text-sm text-muted-foreground">
            {propertyName} · <span className="font-semibold text-foreground">{occupied.length}</span> occupied ·{" "}
            <span className="font-semibold text-foreground">{vacant.length}</span> vacant ·{" "}
            <span className="font-semibold text-foreground">{maintenance.length}</span> maintenance
          </p>
        </div>
        <Button className="gap-2 rounded-xl" onClick={() => setAddingUnit(true)}>
          <Plus className="h-4 w-4" /> Add unit
        </Button>
      </div>

      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-16 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
            <Home className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-foreground">No units yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first vacant unit — then allocate it to a tenant with their initial deposit and rent.
          </p>
          <Button onClick={() => setAddingUnit(true)} className="mt-5 gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> Add your first unit
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => {
            const occupiedUnit = unit.status === "occupied";
            const maintenanceUnit = unit.status === "maintenance";
            return (
              <div key={unit.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-card-foreground">
                      House {unit.houseNumber}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{unit.type}</p>
                  </div>
                  <StatusBadge tone={occupiedUnit ? "success" : maintenanceUnit ? "warning" : "neutral"}>
                    {unit.status === "occupied" ? "Occupied" : unit.status === "maintenance" ? "Maintenance" : "Vacant"}
                  </StatusBadge>
                </div>

                <p className="mt-3 font-display text-xl font-semibold tracking-tight text-card-foreground">
                  {formatKES(unit.monthlyRent)}
                  <span className="text-xs font-medium text-muted-foreground">/month</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Deposit {formatKES(unit.deposit)}
                  {unit.bookingDeposit > 0 ? ` + booking ${formatKES(unit.bookingDeposit)}` : ""}
                </p>

                {occupiedUnit && unit.tenantName && (
                  <div className="mt-4 rounded-xl bg-muted/60 p-3 ring-1 ring-border/50">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-white">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-card-foreground">{unit.tenantName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {unit.tenantPhone ?? ""}{unit.onboarded ? " · onboarded" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {maintenanceUnit && (
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    Withdrawn from letting until maintenance is done.
                  </p>
                )}

                <div className="mt-4 flex gap-2 border-t border-border/50 pt-4">
                  {occupiedUnit ? (
                    <Button variant="outline" className="flex-1 gap-1.5 rounded-xl" disabled>
                      <CheckCircle2 className="h-4 w-4" /> Allocated
                    </Button>
                  ) : maintenanceUnit ? (
                    <Button variant="outline" className="flex-1 gap-1.5 rounded-xl text-amber-700 hover:bg-amber-50" disabled>
                      <Hammer className="h-4 w-4" /> In maintenance
                    </Button>
                  ) : (
                    <Button className="flex-1 gap-1.5 rounded-xl gradient-brand" onClick={() => setAllocating(unit)}>
                      <KeyRound className="h-4 w-4" /> Allocate tenant
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allocating && (
        <AllocateDialog
          unit={allocating}
          token={staffToken}
          onClose={() => setAllocating(null)}
          onDone={() => { setAllocating(null); void refresh(); }}
        />
      )}

      {addingUnit && (
        <AddUnitDialog
          token={staffToken}
          onClose={() => setAddingUnit(false)}
          onDone={() => { setAddingUnit(false); void refresh(); }}
        />
      )}
    </div>
  );
}

function NavigateToLogin() {
  const navigate = useNavigate();
  return (
    <Button variant="outline" onClick={() => navigate("/manager")}>Session expired — sign in again</Button>
  );
}

/* ── Allocation dialog ───────────────────────────────────────────────────── */

const METHOD_LABEL = (m: string) => m;

function AllocateDialog({
  unit, token, onClose, onDone,
}: {
  unit: StaffUnit;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"form" | "success">("form");
  const [busy, setBusy] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);

  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState(String(unit.deposit || ""));
  const [depositMethod, setDepositMethod] = useState("M-Pesa");
  const [depositRef, setDepositRef] = useState("");
  const [rentAmount, setRentAmount] = useState(String(unit.monthlyRent || ""));
  const [rentMethod, setRentMethod] = useState("M-Pesa");
  const [rentRef, setRentRef] = useState("");

  const valid =
    tenantName.trim().length > 1 &&
    tenantPhone.trim().length >= 9 &&
    Number(depositAmount) >= 0 &&
    Number(rentAmount) >= 0;

  const submit = async () => {
    setBusy(true);
    const res = await allocateUnit(token, {
      unitId: unit.id,
      tenantName: tenantName.trim(),
      tenantPhone: tenantPhone.trim(),
      deposit: { amount: Number(depositAmount), method: depositMethod, reference: depositRef.trim() },
      rent: { amount: Number(rentAmount), method: rentMethod, reference: rentRef.trim() },
    });
    setBusy(false);
    if (res.error || !res.data) return toast.error(res.error ?? "Could not allocate the unit.");
    setAccessCode(res.data.accessCode);
    setPhase("success");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopied(true);
      toast.success("Access code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — note it down manually.");
    }
  };

  if (phase === "success") {
    return (
      <Dialog open onOpenChange={(o) => !o && onDone()}>
        <DialogContent className="max-w-md rounded-3xl" data-testid="allocation-success">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">House {unit.houseNumber} allocated</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="text-sm text-muted-foreground">
              {tenantName.trim()} moved into House {unit.houseNumber}. Their deposit and rent are recorded in Payments.
              Give them this 6-digit access code:
            </p>
            <div className="rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 py-5">
              <p className="font-display text-4xl font-bold tracking-[0.3em] text-brand-800" data-testid="access-code-display">
                {accessCode}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700/70">
                Expires in 30 days · single use
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyCode} className="flex-1 gap-2 rounded-xl">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy code
              </Button>
              <Button onClick={onDone} className="flex-1 rounded-xl">Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Allocate House {unit.houseNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tenant */}
          <div className="rounded-2xl border border-border/60 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" /> New tenant
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Full name *</label>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="e.g. Jane Wanjiku" className="h-11 rounded-xl" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Phone *</label>
                <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="+254 7xx xxx xxx" inputMode="tel" className="h-11 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Deposit */}
          <div className="rounded-2xl border border-border/60 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Initial deposit
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Amount (KES) *</label>
                <Input type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="h-11 rounded-xl" inputMode="numeric" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Payment method *</label>
                <Select value={depositMethod} onValueChange={setDepositMethod}>
                  <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABEL(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Reference / receipt no.</label>
                <Input value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder="e.g. QJK7YTX91P or receipt 001" className="h-11 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Rent */}
          <div className="rounded-2xl border border-border/60 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Initial rent
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Amount (KES) *</label>
                <Input type="number" min={0} value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="h-11 rounded-xl" inputMode="numeric" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Payment method *</label>
                <Select value={rentMethod} onValueChange={setRentMethod}>
                  <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABEL(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Reference / receipt no.</label>
                <Input value={rentRef} onChange={(e) => setRentRef(e.target.value)} placeholder="e.g. RCPT-0001" className="h-11 rounded-xl" />
              </div>
            </div>
          </div>

          <p className="rounded-xl bg-brand-50/70 p-3 text-xs leading-relaxed text-brand-800">
            Both payments are recorded permanently with method + reference, visible to the landlord under Payments.
            The tenant completes their profile with the access code.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button onClick={submit} disabled={busy || !valid} className="gap-2 rounded-xl">
              <KeyRound className="h-4 w-4" /> {busy ? "Allocating…" : "Allocate & issue code"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Add unit dialog ─────────────────────────────────────────────────────── */

function AddUnitDialog({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void }) {
  const [houseNumber, setHouseNumber] = useState("");
  const [unitType, setUnitType] = useState("Bedsitter");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!houseNumber.trim()) return toast.error("House number is required.");
    if (!monthlyRent || Number(monthlyRent) < 0) return toast.error("Monthly rent is required.");
    setBusy(true);
    const res = await staffAddUnit(token, houseNumber.trim(), unitType, Number(monthlyRent), Number(deposit || 0));
    setBusy(false);
    if (res.error || !res.data) return toast.error(res.error ?? "Could not add the unit.");
    toast.success(`House ${res.data.houseNumber} added as vacant`);
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add a vacant unit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">House label *</label>
              <Input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="e.g. B3" className="h-11 rounded-xl" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Type</label>
              <Select value={unitType} onValueChange={setUnitType}>
                <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Monthly rent (KES) *</label>
              <Input type="number" min={0} value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className="h-11 rounded-xl" inputMode="numeric" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Security deposit (KES)</label>
              <Input type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} className="h-11 rounded-xl" inputMode="numeric" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button onClick={submit} disabled={busy} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add unit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
