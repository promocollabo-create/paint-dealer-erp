"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { Copy, Download, Loader2, Mail, MessageCircle, Printer, ReceiptText } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import { getShopSettings } from "@/lib/shopSettings";
import { downloadInvoicePdf, printInvoice, shareInvoiceEmail, shareInvoiceWhatsApp } from "@/lib/documents";
import { Invoice, InvoiceStatus, ShopSettings } from "@/types";

function money(n: number, currency = "PKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-swatch-moss/10 text-swatch-moss",
  partial: "bg-swatch-ochre/10 text-swatch-ochre",
  unpaid: "bg-swatch-clay/10 text-swatch-clay",
  cancelled: "bg-ink-100 text-ink-500 dark:bg-ink-700"
};

function InvoiceDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShopSettings().then(setShop);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "invoices", params.id),
      (snap) => {
        if (!snap.exists()) {
          setInvoice(null);
          setLoading(false);
          return;
        }
        const data = snap.data();
        setInvoice({
          id: snap.id,
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

  if (!invoice) {
    return (
      <main className="flex-1 p-5">
        <div className="card py-16 text-center text-ink-400">Invoice not found.</div>
      </main>
    );
  }

  const currency = shop.currency || "PKR";

  return (
    <main className="flex-1 space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">{new Date(invoice.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => printInvoice(invoice, shop)} className="btn-secondary">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={() => downloadInvoicePdf(invoice, shop)} className="btn-secondary">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => shareInvoiceWhatsApp(invoice, shop)} className="btn-secondary">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          <button onClick={() => shareInvoiceEmail(invoice, shop)} className="btn-secondary">
            <Mail className="h-4 w-4" /> Email
          </button>
          <button onClick={() => router.push(`/invoices/new?duplicate=${invoice.id}`)} className="btn-secondary">
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          {invoice.balanceDue > 0 && (
            <Link href={`/payments/new?invoiceId=${invoice.id}`} className="btn-primary">
              <ReceiptText className="h-4 w-4" /> Receive Payment
            </Link>
          )}
        </div>
      </div>

      <div className="card space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4 dark:border-ink-800">
          <div className="flex items-start gap-3">
            {shop.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logoUrl}
                alt={`${shop.shopName || "Shop"} logo`}
                className="h-12 w-12 shrink-0 rounded-lg border border-ink-100 object-contain dark:border-ink-800"
              />
            )}
            <div>
              <p className="font-display text-lg font-semibold">{shop.shopName}</p>
              {shop.address && <p className="text-sm text-ink-500 dark:text-ink-400">{shop.address}</p>}
              <p className="text-sm text-ink-500 dark:text-ink-400">
                {[shop.phone, shop.email].filter(Boolean).join(" · ")}
              </p>
              {shop.ntnStrn && <p className="text-xs text-ink-400">NTN/STRN: {shop.ntnStrn}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className={`badge ${STATUS_STYLES[invoice.status]} mb-2 inline-block capitalize`}>{invoice.status}</span>
            <p className="text-sm text-ink-500 dark:text-ink-400">Bill To</p>
            <p className="font-medium">{invoice.customerName}</p>
            <p className="text-sm text-ink-500 dark:text-ink-400">{invoice.customerPhone}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
              <tr>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Packing</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3 text-right">Unit Price</th>
                <th className="py-2 pr-3 text-right">Disc.</th>
                <th className="py-2 pr-3 text-right">GST</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {invoice.items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{it.productName}</p>
                    <p className="text-xs text-ink-400">
                      {it.series}
                      {it.company ? ` · ${it.company}` : ""}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3">{it.packing || "—"}</td>
                  <td className="py-2.5 pr-3 text-right">{it.quantity}</td>
                  <td className="py-2.5 pr-3 text-right">{money(it.unitPrice, currency)}</td>
                  <td className="py-2.5 pr-3 text-right">{it.discountPercent}%</td>
                  <td className="py-2.5 pr-3 text-right">{it.gstPercent}%</td>
                  <td className="py-2.5 text-right font-medium">{money(it.lineTotal, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500 dark:text-ink-400">Subtotal</span>
              <span>{money(invoice.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500 dark:text-ink-400">Discount</span>
              <span>- {money(invoice.discountTotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500 dark:text-ink-400">GST</span>
              <span>{money(invoice.gstTotal, currency)}</span>
            </div>
            {invoice.whtAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-500 dark:text-ink-400">WHT ({invoice.whtPercent}%)</span>
                <span>- {money(invoice.whtAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base font-semibold dark:border-ink-800">
              <span>Grand Total</span>
              <span>{money(invoice.grandTotal, currency)}</span>
            </div>
            <div className="flex justify-between text-swatch-moss">
              <span>Amount Paid</span>
              <span>{money(invoice.amountPaid, currency)}</span>
            </div>
            <div className="flex justify-between font-medium text-swatch-clay">
              <span>Balance Due</span>
              <span>{money(invoice.balanceDue, currency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <p className="border-t border-ink-100 pt-4 text-sm text-ink-500 dark:border-ink-800 dark:text-ink-400">
            Notes: {invoice.notes}
          </p>
        )}
      </div>
    </main>
  );
}

export default function InvoiceDetailPage() {
  return (
    <>
      <Topbar title="Invoice" />
      <InvoiceDetailContent />
    </>
  );
}
