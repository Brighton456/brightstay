import { useAuth, AuthRole } from "@/contexts/AuthContext";

export function RoleGate({ roles, children }: { roles: AuthRole[]; children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading || !role || !roles.includes(role)) return null;
  return <>{children}</>;
}