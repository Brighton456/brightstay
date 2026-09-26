import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl gradient-brand text-white shadow-brand",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]">
        <path d="M12 3.5 L21 9.5 L20 10.5 L12 5.5 L4 10.5 L3 9.5 Z" fill="currentColor" />
        <path d="M5.5 10 L5.5 17.5 L18.5 17.5 L18.5 10 L19.5 9.5 L19.5 18.5 L4.5 18.5 L4.5 9.5 Z" fill="currentColor" opacity="0.85" />
        <rect x="10.75" y="12.5" width="2.5" height="5" rx="0.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9 text-[17px]" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display font-semibold text-lg tracking-tight", dark ? "text-cream" : "text-foreground")}>
          Bright<span className="text-gradient-brand">Stay</span>
        </span>
        <span className={cn("text-[10px] font-medium uppercase tracking-[0.18em]", dark ? "text-cream/50" : "text-muted-foreground")}>
          Rent made easy
        </span>
      </span>
    </span>
  );
}