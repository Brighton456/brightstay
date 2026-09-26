/**
 * App session context.
 *
 * Auth model (per landlord decision):
 *  - Supabase email signups are disabled; anonymous signups are enabled.
 *  - On boot we sign in anonymously once — that session (role `authenticated`)
 *    is ONLY the RLS carrier. All identity lives in tables:
 *      • staff (landlord/caretaker) → staff_accounts + staff_sessions RPCs
 *      • tenants                    → tenant_identities + code claiming
 *  - No Supabase auth emails or passwords are used anywhere.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import * as staffAuth from "@/services/staffAuth";
import * as tenantPortal from "@/services/tenantPortal";

export type AppRole = "staff" | "tenant";

export interface StaffSessionData {
  kind: "staff";
  token: string;
  user: staffAuth.StaffUser;
  mustChangePassword: boolean;
}

export interface TenantSessionData {
  kind: "tenant";
  token: string;
  tenant: {
    id: string;
    fullName: string;
    unitId: string;
    onboardingCompleted: boolean;
  };
}

export type AppSession = StaffSessionData | TenantSessionData | null;

interface AppSessionContextType {
  ready: boolean; // anonymous RLS carrier established (or not configured)
  session: AppSession;
  signInStaff: (username: string, password: string) => Promise<{ error?: string; mustChangePassword?: boolean }>;
  claimTenant: (code: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshTenantSession: () => Promise<void>;
  clearMustChangePassword: () => void;
}

const AppSessionContext = createContext<AppSessionContextType>({
  ready: false,
  session: null,
  signInStaff: async () => ({}),
  claimTenant: async () => ({}),
  signOut: async () => {},
  refreshTenantSession: async () => {},
  clearMustChangePassword: () => {},
});

const STAFF_KEY = "brightstay.staffSession.v1";
const TENANT_KEY = "brightstay.tenantSession.v1";

function readStored(key: string): { token: string } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === "string" ? { token: parsed.token } : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, token: string | null) {
  try {
    if (token) window.localStorage.setItem(key, JSON.stringify({ token }));
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [staff, setStaff] = useState<StaffSessionData | null>(null);
  const [tenant, setTenant] = useState<TenantSessionData | null>(null);

  // 1. Establish the anonymous RLS-carrier session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await supabase.auth.signInAnonymously();
        }
      } catch {
        /* carrier session optional — RPCs still work via anon key */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Restore table-backed sessions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const staffStored = readStored(STAFF_KEY);
      if (staffStored) {
        const res = await staffAuth.staffSession(staffStored.token);
        if (!cancelled) {
          if (res.valid && res.staff) {
            setStaff({ kind: "staff", token: staffStored.token, user: res.staff, mustChangePassword: false });
          } else {
            writeStored(STAFF_KEY, null);
          }
        }
      }

      const tenantStored = readStored(TENANT_KEY);
      if (tenantStored) {
        const res = await tenantPortal.fetchTenantSession(tenantStored.token);
        if (!cancelled) {
          if (res.data?.tenant) {
            setTenant({ kind: "tenant", token: tenantStored.token, tenant: res.data.tenant });
          } else {
            writeStored(TENANT_KEY, null);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInStaff = useCallback(async (username: string, password: string) => {
    const res = await staffAuth.staffLogin(username, password);
    if (res.error || !res.token || !res.staff) return { error: res.error ?? "Could not sign in." };
    writeStored(STAFF_KEY, res.token);
    setStaff({
      kind: "staff",
      token: res.token,
      user: res.staff,
      mustChangePassword: res.mustChangePassword ?? false,
    });
    return { mustChangePassword: res.mustChangePassword };
  }, []);

  const claimTenant = useCallback(async (code: string) => {
    const res = await tenantPortal.verifyAccessCode(code);
    if (res.error || !res.data) return { error: res.error ?? "Invalid code." };
    writeStored(TENANT_KEY, res.data.token);
    setTenant({ kind: "tenant", token: res.data.token, tenant: res.data.tenant });
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (staff) {
      staffAuth.staffLogout(staff.token).catch(() => {});
      writeStored(STAFF_KEY, null);
      setStaff(null);
    }
    if (tenant) {
      writeStored(TENANT_KEY, null);
      setTenant(null);
    }
  }, [staff, tenant]);

  const refreshTenantSession = useCallback(async () => {
    if (!tenant) return;
    const res = await tenantPortal.fetchTenantSession(tenant.token);
    if (res.data?.tenant) {
      setTenant({ kind: "tenant", token: tenant.token, tenant: res.data.tenant });
    }
  }, [tenant]);

  const clearMustChangePassword = useCallback(() => {
    setStaff((s) => (s ? { ...s, mustChangePassword: false } : s));
  }, []);

  const session: AppSession = useMemo(() => staff ?? tenant, [staff, tenant]);

  return (
    <AppSessionContext.Provider
      value={{ ready, session, signInStaff, claimTenant, signOut, refreshTenantSession, clearMustChangePassword }}
    >
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  return useContext(AppSessionContext);
}
