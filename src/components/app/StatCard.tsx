import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "gold" | "green" | "red" | "neutral" | "sky";
  className?: string;
}

const toneRing: Record<string, string> = {
  gold: "bg-brand-100 text-brand-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-rose-100 text-rose-600",
  sky: "bg-sky-100 text-sky-600",
  neutral: "bg-stone-100 text-stone-600",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", className }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", toneRing[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-2.5 font-display text-[26px] font-semibold tracking-tight text-card-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}