/**
 * Auth context — compatibility layer over AppSessionContext.
 *
 * Email/password signups are disabled (tenant + staff accounts live in DB
 * tables per the Brightcaret pattern). The old Supabase signIn/signUp API is
 * gone; existing portal pages consume `user`/`role`/`signOut` which now derive
 * from the staff table session. Tenants use the access-code flow instead.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import type { StaffUser } from "@/services/staffAuth";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  initials: string;
  role: "landlord" | "caretaker" | "tenant";
}

interface AuthContextType {
  user: AuthUser | null;
  role: "landlord" | "caretaker" | "tenant" | null;
  loading: boolean;
  signOut: () => Promise<void>;
  staffUser: StaffUser | null;
  staffToken: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  staffUser: null,
  staffToken: null,
});

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, session, signOut: appSignOut } = useAppSession();

  let user: AuthUser | null = null;

  if (session?.kind === "staff") {
    const u = session.user;
    user = {
      id: u.id,
      name: u.fullName,
      phone: "",
      email: u.username,
      initials: initials(u.fullName),
      role: u.role,
    };
  } else if (session?.kind === "tenant") {
    user = {
      id: session.tenant.id,
      name: session.tenant.fullName,
      phone: "",
      email: "",
      initials: initials(session.tenant.fullName),
      role: "tenant",
    };
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading: !ready,
        signOut: appSignOut,
        staffUser: session?.kind === "staff" ? session.user : null,
        staffToken: session?.kind === "staff" ? session.token : null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
