"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProductSearchDropdown from "@/components/products/ProductSearchDropdown";
import CustomerSearchDropdown from "@/components/customers/CustomerSearchDropdown";
import { useAuth } from "@/context/AuthContext";
import { getShopSettings } from "@/lib/shopSettings";
import { createInvoiceWithLedger } from "@/lib/ledger";
import { Customer, InvoiceLineItem, Product } from "@/types";
import toast from "react-hot-toast";

function money(n: number, currency = "PKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

let rowIdCounter = 0;
function newRowId() {
  rowIdCounter += 1;
  return `row-${Date.now()}-${rowIdCounter}`;
}

interface DraftLine extends InvoiceLineItem {
  rowId: string;
}

function computeLine(line: DraftLine): DraftLine {
  const gross = line.quantity * line.unitPrice;
  const discountAmount = (gross * line.discountPercent) / 100;
  const taxable = gross - discountAmount;
  const gstAmount = (taxable * line.gstPercent) / 100;
  const lineTotal = taxable + gstAmount;
  return { ...line, discountAmount, gstAmount, lineTotal };
}

function draftFromProduct(p: Product): DraftLine {
  return computeLine({
    rowId: newRowId(),
    productId: p.id,
    productName: p.productName,
    productCode: p.productCode,
    series: p.series,
    packing: p.packing,
    colorName: p.colorName,
    shadeCode: p.shadeCode,
    unit: p.unit || "Pcs",
    quantity: 1,
    unitPrice: p.mrp || p.retailPrice || 0,
    discountPercent: 0,
    discountAmount: 0,
    gstPercent: p.gst || 0,
    gstAmount: 0,
    lineTotal: 0
  });
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const { appUser } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [whtEnabled, setWhtEnabled] = useState(false);
  const [whtPercent, setWhtPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [loadingDuplicate, setLoadingDuplicate] = useState(!!duplicateId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getShopSettings().then((s) => {
      setCurrency(s.currency || "PKR");
      setInvoicePrefix(s.invoicePrefix || "INV-");
    });
  }, []);

  // "Duplicate Invoice": prefill customer + line items from a previous invoice, but a fresh
  // invoice number is always generated on save — never reuse the source invoice's number.
  useEffect(() => {
    if (!duplicateId) return;
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "invoices", duplicateId!));
        if (cancelled || !snap.exists()) {
          if (!cancelled) toast.error("Original invoice not found.");
          return;
        }
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
        const items: InvoiceLineItem[] = data.items ?? [];
        setLines(items.map((it) => computeLine({ ...it, rowId: newRowId() })));
        setWhtEnabled((data.whtPercent ?? 0) > 0);
        setWhtPercent(data.whtPercent ?? 0);
        setNotes(data.notes ?? "");
        toast.success("Loaded original invoice as a starting point.");
      } catch (e) {
        console.error(e);
        toast.error("Could not load the original invoice.");
      } finally {
        if (!cancelled) setLoadingDuplicate(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [duplicateId]);

  function addProduct(p: Product) {
    setLines((prev) => [...prev, draftFromProduct(p)]);
  }

  function updateLine(rowId: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.rowId === rowId ? computeLine({ ...l, ...patch }) : l)));
  }

  function removeLine(rowId: string) {
    setLines((prev) => prev.filter((l) => l.rowId !== rowId));
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const discountTotal = lines.reduce((s, l) => s + l.discountAmount, 0);
    const gstTotal = lines.reduce((s, l) => s + l.gstAmount, 0);
    const beforeWht = subtotal - discountTotal + gstTotal;
    const whtAmount = whtEnabled ? (beforeWht * whtPercent) / 100 : 0;
    const grandTotal = beforeWht - whtAmount;
    return { subtotal, discountTotal, gstTotal, whtAmount, grandTotal };
  }, [lines, whtEnabled, whtPercent]);

  async function handleGenerate() {
    if (saving) return;
    if (!customer) {
      toast.error("Please select a customer.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one product line.");
      return;
    }
    const invalidQty = lines.some((l) => !l.quantity || l.quantity <= 0);
    if (invalidQty) {
      toast.error("Every line needs a quantity greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const items: InvoiceLineItem[] = lines.map(({ rowId, ...rest }) => rest);
      const { id } = await createInvoiceWithLedger({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        gstTotal: totals.gstTotal,
        whtPercent: whtEnabled ? whtPercent : 0,
        whtAmount: totals.whtAmount,
        grandTotal: totals.grandTotal,
        notes,
        createdBy: appUser?.name ?? appUser?.email ?? "unknown",
        invoicePrefix
      });
      toast.success("Invoice generated");
      router.push(`/invoices/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the invoice. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingDuplicate) {
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
      <div className="card space-y-4">
        <h2 className="font-display text-base font-semibold">1. Customer</h2>
        {customer ? (
          <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-sm dark:border-ink-800 dark:bg-ink-800">
            <div>
              <p className="font-medium">{customer.name}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {customer.customerCode} · {customer.phone}
                {customer.outstanding > 0 && ` · Outstanding: ${money(customer.outstanding, currency)}`}
              </p>
            </div>
            <button onClick={() => setCustomer(null)} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="max-w-md">
            <CustomerSearchDropdown onSelect={setCustomer} />
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-display text-base font-semibold">2. Products</h2>
        <div className="max-w-lg">
          <ProductSearchDropdown activeOnly onSelect={addProduct} />
        </div>

        {lines.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-ink-100 dark:border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-ink-100 bg-ink-50 uppercase tracking-wide text-ink-400 dark:border-ink-800 dark:bg-ink-800">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Series</th>
                  <th className="px-3 py-2">Packing</th>
                  <th className="px-3 py-2">Color</th>
                  <th className="px-3 py-2">Shade</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Disc. %</th>
                  <th className="px-3 py-2 text-right">GST %</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {lines.map((l) => (
                  <tr key={l.rowId}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-ink-400">{l.productCode}</p>
                    </td>
                    <td className="px-3 py-2">{l.series || "—"}</td>
                    <td className="px-3 py-2">{l.packing || "—"}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input px-2 py-1 text-xs"
                        placeholder="Optional"
                        value={l.colorName}
                        onChange={(e) => updateLine(l.rowId, { colorName: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input px-2 py-1 text-xs"
                        placeholder="Optional"
                        value={l.shadeCode}
                        onChange={(e) => updateLine(l.rowId, { shadeCode: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="input w-20 px-2 py-1 text-right text-xs"
                        value={l.quantity}
                        onChange={(e) => updateLine(l.rowId, { quantity: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-24 px-2 py-1 text-right text-xs"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.rowId, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="input w-16 px-2 py-1 text-right text-xs"
                        value={l.discountPercent}
                        onChange={(e) => updateLine(l.rowId, { discountPercent: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="input w-16 px-2 py-1 text-right text-xs"
                        value={l.gstPercent}
                        onChange={(e) => updateLine(l.rowId, { gstPercent: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{money(l.lineTotal, currency)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => removeLine(l.rowId)} className="text-swatch-clay hover:underline">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lines.length === 0 && <p className="text-sm text-ink-400">Search a product above to add it as a line item.</p>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="font-display text-base font-semibold">3. Withholding Tax (Optional)</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={whtEnabled} onChange={(e) => setWhtEnabled(e.target.checked)} />
            Apply WHT to this invoice
          </label>
          {whtEnabled && (
            <div className="max-w-[10rem]">
              <label className="label">WHT %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="input"
                value={whtPercent}
                onChange={(e) => setWhtPercent(Number(e.target.value) || 0)}
              />
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="card space-y-2">
          <h2 className="mb-2 font-display text-base font-semibold">Grand Total</h2>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-ink-400">Subtotal</span>
            <span>{money(totals.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-ink-400">Discount</span>
            <span>- {money(totals.discountTotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-ink-400">GST</span>
            <span>{money(totals.gstTotal, currency)}</span>
          </div>
          {whtEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-ink-500 dark:text-ink-400">WHT ({whtPercent}%)</span>
              <span>- {money(totals.whtAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-semibold dark:border-ink-800">
            <span>Grand Total</span>
            <span>{money(totals.grandTotal, currency)}</span>
          </div>

          <button onClick={handleGenerate} disabled={saving} className="btn-primary mt-4 w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate Invoice
          </button>
        </div>
      </div>
    </main>
  );
}

export default function NewInvoicePage() {
  return (
    <>
      <Topbar title="New Invoice" />
      <Suspense
        fallback={
          <main className="flex-1 p-5">
            <div className="card flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          </main>
        }
      >
        <NewInvoiceForm />
      </Suspense>
    </>
  );
}
