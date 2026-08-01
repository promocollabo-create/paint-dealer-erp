"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Loader2, Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getShopSettings } from "@/lib/shopSettings";
import { Customer, LedgerEntry, ShopSettings } from "@/types";

function money(n: number, currency = "PKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function buildLedgerPdf(customer: Customer, entries: LedgerEntry[], shop: ShopSettings) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(shop.shopName || "Paint Dealer", margin, 45);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Customer Ledger — ${customer.name} (${customer.customerCode})`, margin, 64);
  pdf.setFontSize(9);
  pdf.text(`Phone: ${customer.phone}   Outstanding: ${money(customer.outstanding, shop.currency)}`, margin, 78);

  autoTable(pdf, {
    startY: 96,
    head: [["Date", "Description", "Debit", "Credit", "Balance"]],
    body: entries.map((e) => [
      new Date(e.createdAt).toLocaleDateString(),
      e.description,
      e.debit ? money(e.debit, shop.currency) : "",
      e.credit ? money(e.credit, shop.currency) : "",
      money(e.balance, shop.currency)
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [63, 78, 216] },
    margin: { left: margin, right: margin }
  });

  return pdf;
}

function CustomerLedgerContent() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShopSettings().then(setShop);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCustomer() {
      const snap = await getDoc(doc(db, "customers", params.id));
      if (cancelled || !snap.exists()) {
        if (!cancelled) setLoading(false);
        return;
      }
      const c = snap.data();
      setCustomer({
        id: snap.id,
        customerCode: c.customerCode ?? "—",
        name: c.name ?? "",
        phone: c.phone ?? "",
        address: c.address ?? "",
        city: c.city ?? "",
        creditLimit: c.creditLimit ?? 0,
        outstanding: c.outstanding ?? 0,
        notes: c.notes ?? "",
        createdAt: c.createdAt?.toMillis?.() ?? Date.now(),
        updatedAt: c.updatedAt?.toMillis?.() ?? Date.now()
      });
    }
    loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    const q = query(collection(db, "ledgerEntries"), where("customerId", "==", params.id), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              customerId: data.customerId,
              type: data.type,
              refId: data.refId,
              refNumber: data.refNumber,
              description: data.description,
              debit: data.debit ?? 0,
              credit: data.credit ?? 0,
              balance: data.balance ?? 0,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now()
            } as LedgerEntry;
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
  }, [params.id]);

  if (loading || !shop) {
    return (
      <main className="flex-1 p-5">
        <div className="card flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="flex-1 p-5">
        <div className="card py-16 text-center text-ink-400">Customer not found.</div>
      </main>
    );
  }

  const currency = shop.currency || "PKR";
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  function handlePrint() {
    const pdf = buildLedgerPdf(customer!, entries, shop!);
    const blobUrl = pdf.output("bloburl");
    const win = window.open(blobUrl as unknown as string, "_blank");
    win?.addEventListener("load", () => win.print());
  }

  function handleDownload() {
    const pdf = buildLedgerPdf(customer!, entries, shop!);
    pdf.save(`${customer!.customerCode}-ledger.pdf`);
  }

  return (
    <main className="flex-1 space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {customer.customerCode} · {customer.phone}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary">
            <Printer className="h-4 w-4" /> Print Ledger
          </button>
          <button onClick={handleDownload} className="btn-secondary">
            <Download className="h-4 w-4" /> PDF Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-ink-400">Total Debit (Invoiced)</p>
          <p className="font-display text-lg font-semibold">{money(totalDebit, currency)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-ink-400">Total Credit (Paid)</p>
          <p className="font-display text-lg font-semibold text-swatch-moss">{money(totalCredit, currency)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-ink-400">Outstanding Balance</p>
          <p className={`font-display text-lg font-semibold ${customer.outstanding > 0 ? "text-swatch-clay" : "text-swatch-moss"}`}>
            {money(customer.outstanding, currency)}
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3 text-right">Debit</th>
              <th className="px-5 py-3 text-right">Credit</th>
              <th className="px-5 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                  No ledger activity yet. Invoices and payments will appear here automatically.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 text-ink-500 dark:text-ink-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{e.description}</td>
                  <td className="px-5 py-3 text-right text-swatch-clay">{e.debit ? money(e.debit, currency) : "—"}</td>
                  <td className="px-5 py-3 text-right text-swatch-moss">{e.credit ? money(e.credit, currency) : "—"}</td>
                  <td className="px-5 py-3 text-right font-medium">{money(e.balance, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function CustomerLedgerPage() {
  return (
    <ProtectedRoute requiredPermission="customers.manage">
      <Topbar title="Customer Ledger" />
      <CustomerLedgerContent />
    </ProtectedRoute>
  );
}
