import { useState } from "react";
import { Download, Search, Landmark, Banknote, Smartphone, Wallet, CircleEllipsis } from "lucide-react";
import { useStaffData } from "@/hooks/useStaffData";
import { PaymentStatus } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatKES, formatDate } from "@/lib/format";

const METHOD_ICON: Record<string, typeof Wallet> = {
  "M-Pesa": Smartphone,
  Cash: Banknote,
  Bank: Landmark,
  Card: Wallet,
  Other: CircleEllipsis,
};

const CATEGORY_LABEL: Record<string, string> = {
  deposit: "Deposit",
  rent: "Rent",
  booking: "Booking",
  other: "Other",
};

export default function PortalPayments() {
  const { data, loading } = useStaffData();
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [category, setCategory] = useState("all");

  if (loading || !data) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  const payments = data.payments;

  const filtered = payments.filter((p) => {
    const q = query.toLowerCase();
    const matchQ =
      p.tenantName.toLowerCase().includes(q) ||
      (p.reference ?? "").toLowerCase().includes(q) ||
      p.houseNumber.toLowerCase().includes(q);
    return matchQ && (method === "all" || p.method === method) && (category === "all" || p.category === category);
  });

  const totalCollected = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Every shilling recorded with method + reference — {formatKES(totalCollected)} collected
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => toast.info("Export coming soon")}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tenant, house or reference…" className="h-11 rounded-xl pl-10" />
        </div>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="h-11 w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="M-Pesa">M-Pesa</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Bank">Bank</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="booking">Booking</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Tenant</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Reference</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((p) => {
                const Icon = METHOD_ICON[p.method] ?? CircleEllipsis;
                return (
                  <tr key={p.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      {p.tenantName} <span className="text-xs font-normal text-muted-foreground">· House {p.houseNumber}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{CATEGORY_LABEL[p.category] ?? p.category}</td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{formatKES(p.amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Icon className="h-4 w-4" /> {p.method}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{formatDate(p.paidAt)}</td>
                    <td className="px-5 py-3.5 text-right"><PaymentStatus status={p.status} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No payments found{payments.length === 0 ? " — allocations will record the first ones." : "."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Skeleton className="hidden" />
        Records are permanent — payments are never overwritten, so the landlord can confirm receipts even days later.
      </p>
    </div>
  );
}
