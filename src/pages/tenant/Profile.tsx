import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Phone, Home, Users, Briefcase, HeartPulse, ChevronRight, Upload, KeyRound } from "lucide-react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTenantSession, type TenantDashboardData } from "@/services/tenantPortal";
import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES } from "@/lib/format";

const RELATIONSHIP_LABELS: Record<string, string> = {
  parent: "Parent",
  guardian: "Guardian",
  brother: "Brother",
  sister: "Sister",
  friend: "Friend",
  spouse: "Spouse",
  other: "Other",
};

const OCCUPATION_LABELS: Record<string, string> = {
  employed: "Employed",
  student: "Student",
  graduate: "Graduate",
  other: "Other",
};

const MARITAL_LABELS: Record<string, string> = {
  single: "Single",
  married: "Married",
  "prefer-not-to-say": "Prefer not to say",
};

export default function TenantProfile() {
  const navigate = useNavigate();
  const { session, signOut } = useAppSession();
  const { user } = useAuth();
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.kind !== "tenant") return;
    let cancelled = false;
    (async () => {
      const res = await fetchTenantSession(session.token);
      if (!cancelled) {
        setData(res.data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto h-24 w-24 rounded-full" />
        <Skeleton className="mx-auto h-8 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const steps = data?.steps ?? {};
  const unit = data?.unit;

  const signOutAndHome = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-6 animate-slide-in-up">
      <div className="flex flex-col items-center pt-4 text-center">
        <Avatar name={user?.name ?? "Tenant"} hue="bg-gradient-to-br from-brand-400 via-brand-500 to-bronze" size="lg" />
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">{data?.tenant.fullName ?? user?.name}</h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {data?.property?.name ?? "BrightStay"}
          {unit ? ` · House ${unit.houseNumber}` : ""} · Tenant
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Your details</p>
          <div className="space-y-2">
            {[
              { icon: Phone, label: data?.tenant.phone ?? "—" },
              {
                icon: Home,
                label: unit
                  ? `${unit.type} · ${formatKES(unit.monthlyRent)}/month · Deposit ${formatKES(unit.deposit)}`
                  : "House details coming soon",
              },
              {
                icon: Users,
                label:
                  (data?.household.length ?? 0) > 0
                    ? `Living with ${data!.household.length} other${data!.household.length > 1 ? "s" : ""}`
                    : "Living alone",
              },
              {
                icon: Briefcase,
                label: steps["2"]
                  ? `${MARITAL_LABELS[steps["2"].maritalStatus] ?? "—"} · ${OCCUPATION_LABELS[steps["2"].occupation] ?? "—"}`
                  : "Status not set",
              },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">Emergency contacts</p>
          {(data?.emergencyContacts.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {data!.emergencyContacts.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 shadow-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {RELATIONSHIP_LABELS[c.relationship] ?? c.relationship} · {c.phone}
                      {c.county ? ` · ${c.county}` : ""}
                    </p>
                  </div>
                  <HeartPulse className="h-4 w-4 text-rose-500" />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No emergency contacts yet.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => window.alert("Your lease agreement and ID will be available here once uploaded")}
          className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left shadow-card"
        >
          <span className="flex items-center gap-3 text-sm font-medium text-foreground">
            <Upload className="h-4 w-4 text-brand-600" /> My documents
          </span>
          <ChevronRight className="h-4 w-4 text-stone-300" />
        </button>
        <button
          onClick={() => navigate("/tenant/change-password")}
          className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left shadow-card"
          data-testid="tenant-change-password-link"
        >
          <span className="flex items-center gap-3 text-sm font-medium text-foreground">
            <KeyRound className="h-4 w-4 text-brand-600" /> Change my password
          </span>
          <ChevronRight className="h-4 w-4 text-stone-300" />
        </button>
      </div>

      <Button onClick={signOutAndHome} variant="outline" className="h-12 w-full gap-2 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 sm:mx-auto sm:block sm:max-w-xs">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="pb-2 text-center text-[11px] text-muted-foreground">BrightStay v0.1</p>
    </div>
  );
}
