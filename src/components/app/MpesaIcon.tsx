import { cn } from "@/lib/utils";

export function MpesaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("h-6 w-6", className)} aria-hidden>
      <path d="M24 4C13.5 4 5 12.5 5 23v2c0 10.5 8.5 19 19 19s19-8.5 19-19v-2C43 12.5 34.5 4 24 4z" fill="#4CAF50" />
      <path d="M24 10c-2 0-3.5 2-3.5 5v9c0 3 1.5 5 3.5 5s3.5-2 3.5-5v-9c0-3-1.5-5-3.5-5z" fill="#fff" />
      <circle cx="24" cy="24" r="2.5" fill="#d32f2f" />
    </svg>
  );
}