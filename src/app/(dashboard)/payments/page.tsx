"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, limit as fsLimit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Loader2, Plus, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PAYMENT_METHOD_LABELS, Payment, PaymentMethod } from "@/types";

function money(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function PaymentsContent() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"all" | PaymentMethod>("all");

  useEffect(() => {
    const q = query(collection(db, "payments"), orderBy("createdAt", "desc"), fsLimit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPayments(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              receiptNumber: data.receiptNumber ?? "—",
              customerId: data.customerId ?? "",
              customerName: data.customerName ?? "Walk-in",
              invoiceId: data.invoiceId ?? null,
              invoiceNumber: data.invoiceNumber ?? null,
              amount: data.amount ?? 0,
              previousBalance: data.previousBalance ?? 0,
              remainingBalance: data.remainingBalance ?? 0,
              method: data.method ?? "cash",
              referenceNumber: data.referenceNumber ?? "",
              notes: data.notes ?? "",
              createdBy: data.createdBy ?? "",
              createdAt: data.createdAt?.toMillis?.() ?? Date.now()
            } as Payment;
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
    return payments.filter((p) => {
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (!term) return true;
      return (
        p.receiptNumber.toLowerCase().includes(term) ||
        p.customerName.toLowerCase().includes(term) ||
        (p.invoiceNumber ?? "").toLowerCase().includes(term)
      );
    });
  }, [payments, search, methodFilter]);

  const totalToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return payments.filter((p) => p.createdAt >= start.getTime()).reduce((s, p) => s + p.amount, 0);
  }, [payments]);

  return (
    <main className="flex-1 space-y-4 p-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-400">Received Today</p>
          <p className="font-display text-xl font-semibold text-swatch-moss">PKR {money(totalToday)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search by receipt #, customer, or invoice #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as any)}>
            <option value="all">All Methods</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <Link href="/payments/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Receive Payment
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">Receipt #</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3 text-right">Amount</th>
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
                  {search || methodFilter !== "all" ? "No payments match these filters." : "No payments recorded yet."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 font-mono text-xs text-ink-500">{p.receiptNumber}</td>
                  <td className="px-5 py-3 font-medium">{p.customerName}</td>
                  <td className="px-5 py-3 text-ink-500 dark:text-ink-400">{p.invoiceNumber || "—"}</td>
                  <td className="px-5 py-3 text-ink-500 dark:text-ink-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <span className="badge bg-brand-500/10 text-brand-600">{PAYMENT_METHOD_LABELS[p.method]}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-swatch-moss">{money(p.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/payments/${p.id}`} className="text-xs font-medium text-brand-600 hover:underline">
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

export default function PaymentsPage() {
  return (
    <ProtectedRoute requiredPermission="payments.receive">
      <Topbar title="Payments" />
      <PaymentsContent />
    </ProtectedRoute>
  );
}
