import { Link } from "react-router-dom";
import {
  Sparkles,
  Home as HomeIcon,
  Wallet,
  Wrench,
  BarChart3,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { BalanceCard } from "@/components/app/BalanceCard";
import { formatKES } from "@/lib/format";

const FEATURES = [
  { icon: Wallet, title: "M-Pesa STK payments", desc: "Tenants pay rent in two taps. Receipts land instantly." },
  { icon: Wrench, title: "Maintenance in 60s", desc: "Report issues with photos; caretakers get pinged instantly." },
  { icon: BarChart3, title: "Live landlord dashboards", desc: "Rent roll, arrears and occupancy at a glance." },
  { icon: KeyRound, title: "Role-scoped access", desc: "Tenants see only their home. Caretakers run the estate." },
  { icon: ShieldCheck, title: "Audit trail built in", desc: "Every caretaker action logged for your review." },
  { icon: Sparkles, title: "Beautiful to use", desc: "Warm, human design. Your tenants will actually like it." },
];

const ROLES = [
  {
    icon: HomeIcon,
    title: "For tenants",
    desc: "Balance, room details, receipts and a direct line to their caretaker — all in a simple app.",
    points: ["View rent & arrears", "Pay via M-Pesa", "Report issues", "Download receipts"],
    hue: "from-brand-500 to-brand-700",
  },
  {
    icon: KeyRound,
    title: "For caretakers",
    desc: "Record payments offline, manage tenants, assign houses and keep the landlord in the loop.",
    points: ["Add & manage tenants", "Record payments", "Assign rooms", "Monthly reports"],
    hue: "from-emerald-500 to-teal-700",
  },
  {
    icon: BarChart3,
    title: "For landlords",
    desc: "Total visibility across every property with exportable reports and full control.",
    points: ["Financial dashboards", "Approve actions", "Export PDF / Excel", "Manage caretakers"],
    hue: "from-stone-600 to-espresso",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#roles" className="transition hover:text-foreground">Who it's for</a>
            <a href="#footer" className="transition hover:text-foreground">Contact</a>
          </nav>
          <Link to="/auth">
            <Button className="rounded-full">Open app</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-200/50 via-orange-100/40 to-transparent blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
          <div className="animate-slide-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> Residential rental, reimagined
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Every home deserves a <span className="text-gradient-brand">beautiful</span> rental experience
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              BrightStay brings tenants, caretakers and landlords onto one warm platform — payments, maintenance and
              peace of mind, handled.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-13 gap-2 rounded-full px-7">
                  Enter BrightStay <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> M-Pesa STK</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Offline caretaker mode</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> PDF & Excel reports</span>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative mx-auto w-full max-w-[320px] animate-scale-in">
            <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-br from-brand-200/60 to-orange-100/40 blur-2xl" aria-hidden />
            <div className="relative rounded-[38px] border border-stone-800/10 bg-stone-900 p-2.5 shadow-soft">
              <div className="rounded-[30px] bg-background p-4 pb-2">
                <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-stone-900/90" />
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })}</p>
                    <p className="font-display text-[15px] font-semibold text-foreground">Good morning, Brian</p>
                  </div>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-bronze text-[10px] font-bold text-white">BO</span>
                </div>
                <div className="relative overflow-hidden rounded-2xl gradient-brand p-4 pb-5 text-white">
                  <div className="flex items-center gap-1 text-[10px] text-white/85">
                    <Wallet className="h-3 w-3" /> Rent balance
                  </div>
                  <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{formatKES(14_000)}</p>
                  <p className="mt-1 text-[10px] text-white/80">House A1 · due in 9 days</p>
                  <div className="mt-4 rounded-xl bg-card px-3 py-2 text-center text-[11px] font-bold text-brand-800">
                    Pay rent with M-Pesa
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border bg-card p-3 shadow-card">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">From your caretaker</p>
                  <p className="mt-1 text-[11px] font-semibold text-foreground">Plumber coming tomorrow 9–11am</p>
                  <p className="text-[10px] text-muted-foreground">Re: Bathroom tap · Mary</p>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl border bg-card px-4 py-2.5 shadow-card">
                  {[HomeIcon, Wallet, Wrench].map((Icon, i) => (
                    <span key={i} className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${i === 0 ? "bg-brand-100 text-brand-700" : "text-stone-300"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <Wallet className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-card/50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Everything in one place</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">
              Built for the way rentals actually work
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-700/80">Three views, one estate</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">Everyone gets their perfect window</h2>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {ROLES.map(({ icon: Icon, title, desc, points, hue }) => (
              <div key={title} className="flex flex-col rounded-3xl border bg-card p-7 shadow-card">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${hue} text-white shadow-elevated`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] gradient-espresso p-10 text-center shadow-soft sm:p-16">
          <LogoMark className="mx-auto h-14 w-14 text-[26px] rounded-2xl" />
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-semibold tracking-tight text-cream">
            Bring the bright into every stay
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/60">
            Set up in minutes — no hardware, no training sessions. Just connect your estate and let tenants feel at home.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/auth">
              <Button size="lg" className="h-13 gap-2 rounded-full px-8">
                Start exploring <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer id="footer" className="border-t border-border/60 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} BrightStay · Tenants, caretakers & landlords, in sync.</p>
          <div className="flex items-center gap-5 text-xs font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#roles" className="hover:text-foreground">Roles</a>
            <a href="/auth" className="hover:text-foreground">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}