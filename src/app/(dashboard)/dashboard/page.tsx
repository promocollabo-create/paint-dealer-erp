"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  Timestamp
} from "firebase/firestore";
import { CircleDollarSign, CalendarClock, AlertTriangle, Users2 } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import { InvoiceSummary, PaymentSummary } from "@/types";
import { useAuth } from "@/context/AuthContext";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function money(n: number, currency = "PKR") {
  return `${currency} ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export default function DashboardPage() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceSummary[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentSummary[]>([]);
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setDataError(false);
      try {
        const invoicesCol = collection(db, "invoices");
        const paymentsCol = collection(db, "payments");
        const customersCol = collection(db, "customers");

        const [todaySnap, monthSnap, customerCountSnap, recentInvSnap, recentPaySnap, outstandingSnap] =
          await Promise.all([
            getDocs(
              query(invoicesCol, where("createdAt", ">=", Timestamp.fromDate(startOfToday())))
            ),
            getDocs(
              query(invoicesCol, where("createdAt", ">=", Timestamp.fromDate(startOfMonth())))
            ),
            getCountFromServer(customersCol),
            getDocs(query(invoicesCol, orderBy("createdAt", "desc"), limit(5))),
            getDocs(query(paymentsCol, orderBy("createdAt", "desc"), limit(5))),
            getDocs(query(customersCol, where("outstanding", ">", 0)))
          ]);

        if (cancelled) return;

        setTodaySales(todaySnap.docs.reduce((sum, d) => sum + (d.data().total ?? 0), 0));
        setMonthlySales(monthSnap.docs.reduce((sum, d) => sum + (d.data().total ?? 0), 0));
        setCustomerCount(customerCountSnap.data().count);
        setOutstanding(outstandingSnap.docs.reduce((sum, d) => sum + (d.data().outstanding ?? 0), 0));

        setRecentInvoices(
          recentInvSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              invoiceNumber: data.invoiceNumber ?? "—",
              customerName: data.customerName ?? "Walk-in",
              total: data.total ?? 0,
              status: data.status ?? "unpaid",
              createdAt: data.createdAt?.toMillis?.() ?? Date.now()
            };
          })
        );
        setRecentPayments(
          recentPaySnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              customerName: data.customerName ?? "Walk-in",
              amount: data.amount ?? 0,
              method: data.method ?? "cash",
              createdAt: data.createdAt?.toMillis?.() ?? Date.now()
            };
          })
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) setDataError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Topbar title={`Welcome back, ${appUser?.name?.split(" ")[0] ?? ""}`} />
      <main className="flex-1 space-y-6 p-5">
        {dataError && (
          <div className="rounded-lg border border-swatch-clay/30 bg-swatch-clay/10 px-4 py-3 text-sm text-swatch-clay">
            Couldn't load live figures yet — this is expected until the invoices, payments, and
            customers collections exist in Firestore. Numbers will populate automatically once
            data is created.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today's Sales" value={loading ? "…" : money(todaySales)} icon={CircleDollarSign} accent="#2E7D8C" />
          <StatCard label="Monthly Sales" value={loading ? "…" : money(monthlySales)} icon={CalendarClock} accent="#3F4ED8" />
          <StatCard label="Outstanding Amount" value={loading ? "…" : money(outstanding)} icon={AlertTriangle} accent="#C1552E" />
          <StatCard label="Total Customers" value={loading ? "…" : String(customerCount)} icon={Users2} accent="#4C7B5A" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 font-display text-base font-semibold">Recent Invoices</h2>
            {recentInvoices.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-ink-400">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {recentInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">{inv.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{money(inv.total)}</p>
                      <span
                        className={`badge ${
                          inv.status === "paid"
                            ? "bg-swatch-moss/10 text-swatch-moss"
                            : inv.status === "partial"
                            ? "bg-swatch-ochre/10 text-swatch-ochre"
                            : "bg-swatch-clay/10 text-swatch-clay"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="mb-4 font-display text-base font-semibold">Recent Payments</h2>
            {recentPayments.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-ink-400">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{p.customerName}</p>
                      <p className="text-xs capitalize text-ink-500 dark:text-ink-400">{p.method}</p>
                    </div>
                    <p className="text-sm font-medium text-swatch-moss">{money(p.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
