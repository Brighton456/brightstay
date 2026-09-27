/**
 * Export helpers — CSV (opens in Excel) + PDF via jsPDF/autoTable.
 * Shared by Payments, Reports, Tenants and the tenant statement.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatKES, formatDate } from "@/lib/format";
import type { StaffPayment } from "@/services/staffAuth";

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}

function toCsv(rows: (string | number)[][]): string {
  // BOM so Excel reads UTF-8 characters (KES, names) correctly.
  return "\uFEFF" + rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

function pdfTitle(doc: jsPDF, name: string, subtitle: string, startY = 34) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(184, 130, 52);
  doc.text(`BrightStay — ${name}`, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 80, 70);
  doc.text(subtitle, 14, 27);
  return startY;
}

/* ── Payments export ─────────────────────────────────────────────────────── */

export function paymentsCsvRows(payments: StaffPayment[]): (string | number)[][] {
  return [
    ["Date", "Tenant", "House", "Phone", "Type", "Amount (KES)", "Method", "Reference", "Recorded by", "Confirmation", "Transaction status", "Notes"],
    ...payments.map((p) => [
      formatDate(p.paidAt),
      p.tenantName,
      p.houseNumber,
      p.tenantPhone ?? "",
      p.category,
      p.amount,
      p.method,
      p.reference ?? "",
      p.confirmationStatus === "auto_confirmed" ? "System (BrightPay)" : p.recordedByName ?? "",
      p.confirmationStatus ?? "",
      p.status,
      p.notes ?? "",
    ]),
  ];
}

export function exportPaymentsCsv(payments: StaffPayment[], name: string) {
  downloadCsv(paymentsCsvRows(payments), `BrightStay-${name.replace(/\s+/g, "-")}-payments.csv`);
}

export function exportPaymentsPdf(payments: StaffPayment[], name: string) {
  const doc = new jsPDF();
  const total = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const startY = pdfTitle(doc, name, `Payment records · ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} · ${payments.length} transactions`);
  autoTable(doc, {
    startY,
    head: [["Date", "Tenant", "House", "Type", "Amount", "Method", "Reference", "Recorded by", "Confirmation"]],
    body: payments.map((p) => [
      formatDate(p.paidAt),
      p.tenantName,
      p.houseNumber,
      p.category,
      formatKES(p.amount),
      p.method,
      p.reference ?? "—",
      p.confirmationStatus === "auto_confirmed" ? "System" : p.recordedByName ?? "—",
      (p.confirmationStatus ?? "confirmed").replace("_", " "),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [196, 148, 74], textColor: [255, 255, 255] },
    columnStyles: { 4: { halign: "right" } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after = (doc as any).lastAutoTable?.finalY ?? startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total collected (completed): ${formatKES(total)}`, 14, after + 10);
  doc.save(`BrightStay-${name.replace(/\s+/g, "-")}-payments.pdf`);
}

/* ── Generic ledger/statement PDF (tenants, rent months) ─────────────────── */

export function exportTablePdf(opts: {
  title: string;
  name: string;
  subtitle: string;
  head: string[];
  body: (string | number)[][];
  filename: string;
  totalsLine?: string;
}) {
  const doc = new jsPDF();
  const startY = pdfTitle(doc, opts.name, opts.subtitle);
  autoTable(doc, {
    startY,
    head: [opts.head],
    body: opts.body.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [196, 148, 74], textColor: [255, 255, 255] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after = (doc as any).lastAutoTable?.finalY ?? startY;
  if (opts.totalsLine) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(opts.totalsLine, 14, after + 10);
  }
  doc.save(opts.filename);
}

export function exportTableCsv(opts: { rows: (string | number)[][]; filename: string }) {
  downloadCsv(opts.rows, opts.filename);
}
