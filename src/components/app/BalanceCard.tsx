import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BalanceCardProps {
  amount: number;
  label: string;
  sublabel: string;
  status: "due" | "clear";
  daysLeft?: number | null;
  children?: React.ReactNode;
}

export function BalanceCard({ amount, label, sublabel, status, daysLeft, children }: BalanceCardProps) {
  const clear = status === "clear" || amount <= 0;
  return (
    <div className="relative overflow-hidden rounded-[26px] gradient-brand text-white shadow-brand">
      <div
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-card/20 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-black/10 blur-2xl"
        aria-hidden
      />
      <div className="relative z-10 p-6 pb-7">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 text-white/85">
            {clear ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            <span className="text-sm font-medium tracking-wide">{label}</span>
          </div>
          <Badge className={cn("border-0 bg-card/20 text-white backdrop-blur", clear && "bg-card/25")}>
            {clear ? "Clear" : "Due now"}
          </Badge>
        </div>
        <p className="mt-3 font-display text-[44px] leading-none font-semibold tracking-tight">
          {formatKES(amount)}
        </p>
        <p className="mt-2 text-sm text-white/80">{sublabel}</p>

        {typeof daysLeft === "number" && daysLeft >= 0 && !clear && (
          <p className="mt-3 inline-flex items-center rounded-full bg-card/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            Next payment in {daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}