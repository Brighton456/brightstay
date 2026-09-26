import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  hue = "bg-stone-400",
  size = "md",
  className,
}: {
  name: string;
  hue?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white shadow-elevated",
        hue,
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}