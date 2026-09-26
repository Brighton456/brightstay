import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700/80">{eyebrow}</p>
        )}
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}