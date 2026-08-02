"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Loader2, ReceiptText, X } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import CustomerSearchDropdown from "@/components/customers/CustomerSearchDropdown";
import { useAuth } from "@/context/AuthContext";
import { getShopSettings } from "@/lib/shopSettings";
import { recordPaymentWithLedger } from "@/lib/ledger";
import { Customer, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PaymentMethod } from "@/types";
import toast from "react-hot-toast";

function money(n: number, currency = "PKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  balanceDue: number;
}

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedInvoiceId = searchParams.get("invoiceId");
  const { appUser } = useAuth();

  const [currency, setCurrency] = useState("PKR");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPrefill, setLoadingPrefill] = useState(!!preselectedInvoiceId);

  useEffect(() => {
    getShopSettings().then((s) => setCurrency(s.currency || "PKR"));
  }, []);

  // Preselect customer + invoice when arriving from an invoice's "Receive Payment" button.
  useEffect(() => {
    if (!preselectedInvoiceId) return;
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "invoices", preselectedInvoiceId!));
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        if (data.customerId) {
          const custSnap = await getDoc(doc(db, "customers", data.customerId));
          if (custSnap.exists()) {
            const c = custSnap.data();
            setCustomer({
              id: custSnap.id,
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
        }
        setInvoiceId(preselectedInvoiceId!);
        setAmount(String(data.balanceDue ?? 0));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingPrefill(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [preselectedInvoiceId]);

  // Load the selected customer's open (unpaid/partial) invoices for the optional invoice link.
  useEffect(() => {
    if (!customer) {
      setOpenInvoices([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "invoices"), where("customerId", "==", customer!.id), where("balanceDue", ">", 0))
        );
        if (cancelled) return;
        setOpenInvoices(
          snap.docs.map((d) => ({
            id: d.id,
            invoiceNumber: d.data().invoiceNumber ?? "—",
            balanceDue: d.data().balanceDue ?? 0
          }))
        );
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const previousBalance = customer?.outstanding ?? 0;
  const amountNum = Number(amount) || 0;
  const remainingBalance = previousBalance - amountNum;

  async function handleSubmit() {
    if (saving) return;
    if (!customer) {
      toast.error("Please select a customer.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a payment amount greater than 0.");
      return;
    }
    setSaving(true);
    try {
      const selectedInvoice = openInvoices.find((i) => i.id === invoiceId);
      const { id } = await recordPaymentWithLedger({
        customerId: customer.id,
        customerName: customer.name,
        invoiceId: invoiceId || null,
        invoiceNumber: selectedInvoice?.invoiceNumber ?? null,
        amount: amountNum,
        method,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        createdBy: appUser?.name ?? appUser?.email ?? "unknown"
      });
      toast.success("Payment recorded");
      router.push(`/payments/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not record the payment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingPrefill) {
    return (
      <main className="flex-1 p-5">
        <div className="card flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 space-y-5 p-5">
      <div className="mx-auto grid max-w-2xl gap-5">
        <div className="card space-y-4">
          <h2 className="font-display text-base font-semibold">Customer</h2>
          {customer ? (
            <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-sm dark:border-ink-800 dark:bg-ink-800">
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {customer.customerCode} · {customer.phone}
                </p>
              </div>
              <button
                onClick={() => {
                  setCustomer(null);
                  setInvoiceId("");
                }}
                className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <CustomerSearchDropdown onSelect={setCustomer} />
          )}

          {customer && (
            <div>
              <label className="label">Invoice (optional)</label>
              <select className="input" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                <option value="">General payment (not tied to a specific invoice)</option>
                {openInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Due {money(inv.balanceDue, currency)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-display text-base font-semibold">Payment Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Previous Balance</label>
              <input className="input bg-ink-50 dark:bg-ink-800" disabled value={money(previousBalance, currency)} />
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Remaining Balance</label>
            <input
              className={`input bg-ink-50 font-medium dark:bg-ink-800 ${remainingBalance > 0 ? "text-swatch-clay" : "text-swatch-moss"}`}
              disabled
              value={money(remainingBalance, currency)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Reference Number</label>
              <input
                className="input"
                placeholder="Cheque #, transaction ID, etc."
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
            Generate Professional Receipt
          </button>
        </div>
      </div>
    </main>
  );
}

export default function NewPaymentPage() {
  return (
    <>
      <Topbar title="Receive Payment" />
      <Suspense
        fallback={
          <main className="flex-1 p-5">
            <div className="card flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          </main>
        }
      >
        <NewPaymentForm />
      </Suspense>
    </>
  );
}
