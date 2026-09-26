import { Navigate } from "react-router-dom";
import { useAppSession } from "@/contexts/AppSessionContext";
import { SplashScreen } from "@/components/app/SplashScreen";

/**
 * Route guard over table-backed sessions.
 * - roles=["tenant"]       → any tenant session
 * - roles=["landlord","caretaker"] → staff session with that role
 */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: ("landlord" | "caretaker" | "tenant")[];
}) {
  const { ready, session } = useAppSession();

  if (!ready) return <SplashScreen />;
  if (!session) return <Navigate to="/auth" replace />;

  if (roles && roles.length > 0) {
    if (session.kind === "tenant") {
      if (!roles.includes("tenant")) return <Navigate to="/app" replace />;
    } else {
      const role = session.user.role;
      if (!roles.includes(role)) return <Navigate to={role === "tenant" ? "/app" : "/portal"} replace />;
    }
  }

  return <>{children}</>;
}
