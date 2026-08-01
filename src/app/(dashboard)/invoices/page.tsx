"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, limit as fsLimit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Loader2, Plus, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import { Invoice, InvoiceStatus } from "@/types";

function money(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-swatch-moss/10 text-swatch-moss",
  partial: "bg-swatch-ochre/10 text-swatch-ochre",
  unpaid: "bg-swatch-clay/10 text-swatch-clay",
  cancelled: "bg-ink-100 text-ink-500 dark:bg-ink-700"
};

function InvoicesContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");

  useEffect(() => {
    const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"), fsLimit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvoices(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              invoiceNumber: data.invoiceNumber ?? "—",
              customerId: data.customerId ?? "",
              customerName: data.customerName ?? "Walk-in",
              customerPhone: data.customerPhone ?? "",
              items: data.items ?? [],
              subtotal: data.subtotal ?? 0,
              discountTotal: data.discountTotal ?? 0,
              gstTotal: data.gstTotal ?? 0,
              whtPercent: data.whtPercent ?? 0,
              whtAmount: data.whtAmount ?? 0,
              grandTotal: data.grandTotal ?? 0,
              amountPaid: data.amountPaid ?? 0,
              balanceDue: data.balanceDue ?? 0,
              status: data.status ?? "unpaid",
              notes: data.notes ?? "",
              createdBy: data.createdBy ?? "",
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() ?? Date.now()
            } as Invoice;
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (!term) return true;
      return inv.invoiceNumber.toLowerCase().includes(term) || inv.customerName.toLowerCase().includes(term);
    });
  }, [invoices, search, statusFilter]);

  return (
    <main className="flex-1 space-y-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search by invoice # or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New Invoice
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">Invoice #</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Grand Total</th>
              <th className="px-5 py-3 text-right">Balance Due</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  {search || statusFilter !== "all" ? "No invoices match these filters." : "No invoices yet — create your first one."}
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 font-mono text-xs text-ink-500">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 font-medium">{inv.customerName}</td>
                  <td className="px-5 py-3 text-ink-500 dark:text-ink-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">{money(inv.grandTotal)}</td>
                  <td className={`px-5 py-3 text-right font-medium ${inv.balanceDue > 0 ? "text-swatch-clay" : "text-swatch-moss"}`}>
                    {money(inv.balanceDue)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/invoices/${inv.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function InvoicesPage() {
  return (
    <>
      <Topbar title="Invoices" />
      <InvoicesContent />
    </>
  );
}
