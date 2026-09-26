import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSessionProvider, useAppSession } from "@/contexts/AppSessionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { default as ThemeProvider } from "@/contexts/ThemeContext";
import { SplashScreen } from "@/components/app/SplashScreen";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ManagerLogin from "@/pages/ManagerLogin";
import ManagerChangePassword from "@/pages/ManagerChangePassword";
import TenantAccess from "@/pages/TenantAccess";
import TenantOnboarding from "@/pages/TenantOnboarding";
import NotFound from "@/pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import TenantShell from "@/components/layout/TenantShell";
import TenantHome from "@/pages/tenant/Home";
import TenantPayments from "@/pages/tenant/Payments";
import TenantHouse from "@/pages/tenant/House";
import TenantRequests from "@/pages/tenant/Requests";
import TenantProfile from "@/pages/tenant/Profile";

import PortalShell from "@/components/layout/PortalShell";
import PortalDashboard from "@/pages/portal/Dashboard";
import PortalRooms from "@/pages/portal/Rooms";
import PortalTenants from "@/pages/portal/Tenants";
import PortalPayments from "@/pages/portal/Payments";
import PortalRequests from "@/pages/portal/Requests";
import PortalReports from "@/pages/portal/Reports";
import PortalCaretakers from "@/pages/portal/Caretakers";
import PortalAccounting from "@/pages/portal/Accounting";
import PortalRankings from "@/pages/portal/Rankings";
import PortalSettings from "@/pages/portal/Settings";
import PortalAdvancedSettings from "@/pages/portal/AdvancedSettings";

const queryClient = new QueryClient();

/** Home for signed-in users based on their table-backed session. */
function RoleHome() {
  const { session } = useAppSession();
  if (session?.kind === "tenant") {
    return <Navigate to={session.tenant.onboardingCompleted ? "/app" : "/tenant/onboarding"} replace />;
  }
  if (session?.kind === "staff") return <Navigate to="/portal" replace />;
  return <Navigate to="/auth" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/manager" element={<ManagerLogin />} />
      <Route path="/manager/change-password" element={<ManagerChangePassword />} />
      <Route path="/tenant/access" element={<TenantAccess />} />
      <Route path="/tenant/onboarding" element={<TenantOnboarding />} />
      <Route path="/home" element={<RoleHome />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute roles={["caretaker", "landlord"]}>
            <SplashScreen />
          </ProtectedRoute>
        }
      />

      {/* Tenant app (code-claimed sessions) */}
      <Route path="/app" element={<ProtectedRoute roles={["tenant"]}><TenantShell /></ProtectedRoute>}>
        <Route index element={<TenantHome />} />
        <Route path="payments" element={<TenantPayments />} />
        <Route path="house" element={<TenantHouse />} />
        <Route path="requests" element={<TenantRequests />} />
        <Route path="profile" element={<TenantProfile />} />
      </Route>

      {/* Staff portal (table-backed staff sessions) */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={["caretaker", "landlord"]}>
            <PortalShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<PortalDashboard />} />
        <Route path="rooms" element={<PortalRooms />} />
        <Route path="tenants" element={<PortalTenants />} />
        <Route path="payments" element={<PortalPayments />} />
        <Route path="requests" element={<PortalRequests />} />
        <Route path="reports" element={<PortalReports />} />
        <Route path="caretakers" element={<PortalCaretakers />} />
        <Route path="accounting" element={<PortalAccounting />} />
        <Route path="rankings" element={<PortalRankings />} />
        <Route path="settings" element={<PortalSettings />} />
        <Route
          path="settings/advanced"
          element={
            <ProtectedRoute roles={["landlord"]}>
              <PortalAdvancedSettings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" richColors />
      <ThemeProvider>
        <AppSessionProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </AppSessionProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
