import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "gold";

const tones: Record<Tone, string> = {
  success: "status-success",
  warning: "status-warning",
  danger: "status-danger",
  neutral: "status-neutral",
  info: "status-info",
  gold: "status-pill bg-brand-50 text-brand-700 ring-1 ring-brand-500/30",
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn(tones[tone], className)}>{children}</span>;
}

const paymentTone: Record<string, Tone> = { completed: "success", pending: "warning", failed: "danger" };
export function PaymentStatus({ status }: { status: string }) {
  const labels: Record<string, string> = { completed: "Completed", pending: "Pending", failed: "Failed" };
  return <StatusBadge tone={paymentTone[status] ?? "neutral"}>{labels[status] ?? status}</StatusBadge>;
}

const requestTone: Record<string, Tone> = {
  submitted: "neutral",
  in_review: "info",
  in_progress: "warning",
  completed: "success",
  closed: "neutral",
};
export function RequestStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    in_progress: "In progress",
    completed: "Completed",
    closed: "Closed",
  };
  return <StatusBadge tone={requestTone[status] ?? "neutral"}>{labels[status] ?? status}</StatusBadge>;
}

const invoiceTone: Record<string, Tone> = { paid: "success", partial: "gold", unpaid: "neutral", overdue: "danger" };
export function InvoiceStatus({ status }: { status: string }) {
  const labels: Record<string, string> = { paid: "Paid", partial: "Partially paid", unpaid: "Unpaid", overdue: "Overdue" };
  return <StatusBadge tone={invoiceTone[status] ?? "neutral"}>{labels[status] ?? status}</StatusBadge>;
}