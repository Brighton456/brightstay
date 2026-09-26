import { Navigate } from "react-router-dom";
import { Banknote, Receipt, TrendingDown, FileDown, FileSpreadsheet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subMonths } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffData } from "@/hooks/useStaffData";
import { StatCard } from "@/components/app/StatCard";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatKES } from "@/lib/format";

export default function PortalReports() {
  const { role } = useAuth();
  const { data, loading } = useStaffData();
  if (role !== "landlord") return <Navigate to="/portal" replace />;

  if (loading || !data) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  const name = data.property?.name || "BrightStay";
  const payments = data.payments;
  const units = data.units;

  const monthPrefix = format(new Date(), "yyyy-MM");
  const collected =
    payments.filter((p) => p.status === "completed" && p.paidAt?.startsWith(monthPrefix)).reduce((s, p) => s + p.amount, 0) || 0;

  const series = Array.from({ length: 6 }).map((_, i) => {
    const key = format(subMonths(new Date(), 5 - i), "yyyy-MM");
    const rent = payments
      .filter((p) => p.status === "completed" && (p.paidAt ?? "").startsWith(key))
      .reduce((s, p) => s + p.amount, 0);
    return { month: format(subMonths(new Date(), 5 - i), "MMM"), rent: Math.round(rent / 1000) };
  });

  // Tenant payment summary
  const byTenant = new Map<string, { house: string; deposit: number; rent: number }>();
  payments
    .filter((p) => p.status === "completed")
    .forEach((p) => {
      const entry = byTenant.get(p.tenantName) ?? { house: `House ${p.houseNumber}`, deposit: 0, rent: 0 };
      if (p.category === "deposit") entry.deposit += p.amount;
      else entry.rent += p.amount;
      byTenant.set(p.tenantName, entry);
    });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(184, 130, 52);
    doc.text(`BrightStay — ${name}`, 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 80, 70);
    doc.text(`Financial report · ${new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })}`, 14, 27);
    autoTable(doc, {
      startY: 34,
      head: [["Metric", "Amount"]],
      body: [
        ["Rent roll (occupied units)", formatKES(units.filter((u) => u.status === "occupied").reduce((s, u) => s + u.monthlyRent, 0))],
        ["Collected this month", formatKES(collected)],
        ["Deposits held", formatKES(payments.filter((p) => p.category === "deposit" && p.status === "completed").reduce((s, p) => s + p.amount, 0))],
        ["Total collected", formatKES(payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0))],
      ],
      theme: "grid",
      headStyles: { fillColor: [196, 148, 74], textColor: [255, 255, 255] },
    });
    doc.save(`BrightStay-${name.replace(/\s+/g, "-")}-Report.pdf`);
    toast.success("PDF report downloaded");
  };

  const exportExcel = () => {
    const rows = [
      ["Tenant", "House", "Rent paid", "Deposit held"],
      ...Array.from(byTenant.entries()).map(([tenant, v]) => [tenant, v.house, v.rent, v.deposit]),
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BrightStay-${name.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Excel report downloaded");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Financial reports</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "MMMM yyyy")} · {name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button className="gap-2 rounded-xl" onClick={exportPDF}>
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rent roll / month" value={formatKES(units.filter((u) => u.status === "occupied").reduce((s, u) => s + u.monthlyRent, 0))} icon={Banknote} tone="gold" />
        <StatCard label="Collected this month" value={formatKES(collected)} icon={Receipt} tone="green" />
        <StatCard
          label="Deposits held"
          value={formatKES(payments.filter((p) => p.category === "deposit" && p.status === "completed").reduce((s, p) => s + p.amount, 0))}
          icon={TrendingDown}
          tone="neutral"
        />
        <StatCard
          label="Total collected"
          value={formatKES(payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0))}
          icon={Banknote}
          tone="gold"
        />
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <SectionHeading eyebrow="Trend" title="Collections by month" />
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="k" />
              <Tooltip
                formatter={(v: number | string) => [`KES ${v}k`, undefined]}
                contentStyle={{ borderRadius: 14, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-elevated)", fontSize: 13 }}
              />
              <Bar dataKey="rent" name="Rent" radius={[8, 8, 0, 0]} fill="hsl(var(--brand-400))" barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-card">
        <div className="px-5 pt-5">
          <SectionHeading eyebrow="Ledger" title="Per-tenant payments" className="!flex-col !items-start" />
        </div>
        <div className="mt-3 overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4 font-semibold">Tenant</th>
                <th className="py-3 pr-4 font-semibold">House</th>
                <th className="py-3 pr-4 font-semibold">Rent paid</th>
                <th className="py-3 font-semibold">Deposit held</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {Array.from(byTenant.entries()).map(([tenant, v]) => (
                <tr key={tenant}>
                  <td className="py-3 pr-4 font-semibold text-foreground">{tenant}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{v.house}</td>
                  <td className="py-3 pr-4 font-medium text-foreground">{formatKES(v.rent)}</td>
                  <td className="py-3 font-medium text-foreground">{formatKES(v.deposit)}</td>
                </tr>
              ))}
              {byTenant.size === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No payments recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
