import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Home,
  Users,
  Wallet,
  Wrench,
  BarChart3,
  KeyRound,
  Settings,
  Menu,
  LogOut,
  Bell,
  Calculator,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/app/Avatar";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  landlordOnly?: boolean;
  caretakerOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { to: "/portal/rooms", label: "Rooms", icon: Home },
  { to: "/portal/tenants", label: "Tenants", icon: Users },
  { to: "/portal/payments", label: "Payments", icon: Wallet },
  { to: "/portal/requests", label: "Maintenance", icon: Wrench },
  { to: "/portal/reports", label: "Reports", icon: BarChart3, landlordOnly: true },
  { to: "/portal/caretakers", label: "Caretakers", icon: KeyRound, landlordOnly: true },
  { to: "/portal/accounting", label: "Accounting", icon: Calculator, landlordOnly: true },
  { to: "/portal/rankings", label: "Rankings", icon: Trophy, landlordOnly: true },
  { to: "/portal/settings", label: "Settings", icon: Settings },
];

export default function PortalShell() {
  const { role, user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();

  const items = NAV.filter(
    (n) => (n.landlordOnly && role === "landlord") || (n.caretakerOnly && role === "caretaker") || (!n.landlordOnly && !n.caretakerOnly)
  );

  const pageTitle = items.find((n) => (n.to === "/portal" ? pathname === "/portal" : pathname.startsWith(n.to)))?.label ?? "Dashboard";
  const activePage = items.find((i) => (i.to === "/portal" ? pathname === "/portal" : pathname.startsWith(i.to)));

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
      {items.map(({ to, label, icon: Icon }) => {
        const active = to === "/portal" ? pathname === "/portal" : pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-card/10 text-brand-400 shadow-inner ring-1 ring-white/10"
                : "text-sidebar-foreground/70 hover:bg-card/5 hover:text-sidebar-foreground"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-400" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
            {label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full gradient-brand" />}
          </NavLink>
        );
      })}
    </nav>
  );

  const SidebarFooter = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-xl bg-card/5 p-2.5">
        <Avatar name={user?.name ?? "User"} hue="bg-gradient-to-br from-brand-400 to-brand-700" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{user?.name}</p>
          <p className="text-[11px] capitalize text-sidebar-foreground/50">{role}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-lg p-2 text-sidebar-foreground/60 transition hover:bg-card/10 hover:text-brand-400"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const Brand = (
    <div className="flex h-16 items-center border-b border-white/10 px-5">
      <Link to="/portal">
        <Logo dark />
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="gradient-espresso sticky top-0 hidden h-screen w-64 flex-col lg:flex">
        {Brand}
        <NavList />
        {SidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-espresso text-white shadow-elevated">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="gradient-espresso w-64 border-white/10 p-0 text-white">
            {Brand}
            <NavList onNavigate={() => document.body.click()} />
            {SidebarFooter}
          </SheetContent>
        </Sheet>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          {isMobile && <span className="w-10" />}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700 lg:hidden">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">{pageTitle}</h1>
            {activePage?.landlordOnly && (
              <span className="hidden rounded-full bg-brand-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 sm:inline">
                Landlord
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground shadow-card transition hover:shadow-elevated">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full gradient-brand" />
            </button>
            <Link to="/portal/settings">
              <Avatar name={user?.name ?? "User"} hue="bg-gradient-to-br from-brand-500 to-bronze" size="sm" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}