import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, Wallet, Wrench, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/app/Logo";

const NAV = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/payments", label: "Payments", icon: Wallet },
  { to: "/app/requests", label: "Requests", icon: Wrench },
  { to: "/app/profile", label: "Profile", icon: UserRound },
];

export default function TenantShell() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/app" className="flex shrink-0 items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-display text-[17px] font-semibold tracking-tight text-foreground">
              Bright<span className="text-gradient-brand">Stay</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 shadow-card sm:flex">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                    active ? "bg-brand-100/90 text-brand-800" : "text-stone-500 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <Link
            to="/app/profile"
            className="inline-flex h-9 items-center rounded-full bg-card px-3 text-xs font-semibold text-foreground shadow-card transition hover:shadow-elevated"
          >
            {user?.name.split(" ")[0] ?? "Profile"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-5 sm:px-6 md:pb-14 lg:px-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-card/90 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors",
                  active ? "text-brand-700" : "text-stone-400 hover:text-stone-600",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-12 items-center justify-center rounded-full transition-all",
                    active && "bg-brand-100/80",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px]", active && "text-brand-700")} />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
