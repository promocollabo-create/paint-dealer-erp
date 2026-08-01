"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { Download, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import { getShopSettings } from "@/lib/shopSettings";
import { downloadReceiptPdf, printReceipt, shareReceiptEmail, shareReceiptWhatsApp } from "@/lib/documents";
import { PAYMENT_METHOD_LABELS, Payment, ShopSettings } from "@/types";

function money(n: number, currency = "PKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function PaymentDetailContent() {
  const params = useParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShopSettings().then(setShop);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "payments", params.id),
      (snap) => {
        if (!snap.exists()) {
          setPayment(null);
          setLoading(false);
          return;
        }
        const data = snap.data();
        setPayment({
          id: snap.id,
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
        });
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

  if (!payment) {
    return (
      <main className="flex-1 p-5">
        <div className="card py-16 text-center text-ink-400">Receipt not found.</div>
      </main>
    );
  }

  const currency = shop.currency || "PKR";

  return (
    <main className="flex-1 space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{payment.receiptNumber}</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">{new Date(payment.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => printReceipt(payment, shop)} className="btn-secondary">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={() => downloadReceiptPdf(payment, shop)} className="btn-secondary">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => shareReceiptWhatsApp(payment, shop)} className="btn-secondary">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          <button onClick={() => shareReceiptEmail(payment, shop)} className="btn-secondary">
            <Mail className="h-4 w-4" /> Email
          </button>
        </div>
      </div>

      <div className="card mx-auto max-w-lg space-y-6">
        <div className="border-b border-ink-100 pb-4 text-center dark:border-ink-800">
          <p className="font-display text-lg font-semibold">{shop.shopName}</p>
          {shop.address && <p className="text-sm text-ink-500 dark:text-ink-400">{shop.address}</p>}
          <p className="text-sm text-ink-500 dark:text-ink-400">{[shop.phone, shop.email].filter(Boolean).join(" · ")}</p>
          <p className="mt-3 text-sm font-medium uppercase tracking-wide text-brand-600">Payment Receipt</p>
        </div>

        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500 dark:text-ink-400">Receipt #</dt>
          <dd className="text-right font-mono">{payment.receiptNumber}</dd>
          <dt className="text-ink-500 dark:text-ink-400">Date</dt>
          <dd className="text-right">{new Date(payment.createdAt).toLocaleDateString()}</dd>
          <dt className="text-ink-500 dark:text-ink-400">Customer</dt>
          <dd className="text-right">
            <Link href={`/customers/${payment.customerId}/ledger`} className="text-brand-600 hover:underline">
              {payment.customerName}
            </Link>
          </dd>
          <dt className="text-ink-500 dark:text-ink-400">Invoice</dt>
          <dd className="text-right">{payment.invoiceNumber || "—"}</dd>
          <dt className="text-ink-500 dark:text-ink-400">Payment Method</dt>
          <dd className="text-right">{PAYMENT_METHOD_LABELS[payment.method]}</dd>
          <dt className="text-ink-500 dark:text-ink-400">Reference #</dt>
          <dd className="text-right">{payment.referenceNumber || "—"}</dd>
        </dl>

        <div className="space-y-1.5 border-t border-ink-100 pt-4 text-sm dark:border-ink-800">
          <div className="flex justify-between">
            <span className="text-ink-500 dark:text-ink-400">Previous Balance</span>
            <span>{money(payment.previousBalance, currency)}</span>
          </div>
          <div className="flex justify-between font-medium text-swatch-moss">
            <span>Amount Received</span>
            <span>{money(payment.amount, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base font-semibold dark:border-ink-800">
            <span>Remaining Balance</span>
            <span className={payment.remainingBalance > 0 ? "text-swatch-clay" : "text-swatch-moss"}>
              {money(payment.remainingBalance, currency)}
            </span>
          </div>
        </div>

        {payment.notes && (
          <p className="border-t border-ink-100 pt-4 text-sm text-ink-500 dark:border-ink-800 dark:text-ink-400">
            Notes: {payment.notes}
          </p>
        )}
      </div>
    </main>
  );
}

export default function PaymentDetailPage() {
  return (
    <>
      <Topbar title="Payment Receipt" />
      <PaymentDetailContent />
    </>
  );
}
