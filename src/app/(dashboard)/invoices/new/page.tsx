"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProductSearchDropdown from "@/components/products/ProductSearchDropdown";
import AccessorySearchDropdown from "@/components/products/AccessorySearchDropdown";
import CustomerSearchDropdown from "@/components/customers/CustomerSearchDropdown";
import { useAuth } from "@/context/AuthContext";
import { getShopSettings } from "@/lib/shopSettings";
import { createInvoiceWithLedger } from "@/lib/ledger";
import { calculateInvoiceItem, calculateInvoiceTotals } from "@/lib/invoiceCalc";
import { AccessorySection, Customer, InvoiceLineItem, Product } from "@/types";
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
  const { discountAmount, gstAmount, lineTotal } = calculateInvoiceItem({
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPercent: line.discountPercent,
    gstPercent: line.gstPercent
  });
  return { ...line, discountAmount, gstAmount, lineTotal };
}

/** Touch-friendly [-] value [+] quantity control used on mobile item cards and pickers —
 *  large tap targets instead of relying on the native number input's tiny spinner arrows. */
function QuantityStepper({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  function step(delta: number) {
    const next = Math.max(0.01, Math.round(((Number(value) || 0) + delta) * 100) / 100);
    onChange(String(next));
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => step(-1)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.01"
        className="input h-10 w-16 px-1 text-center"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => step(1)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

/** Top-level product picker for a new invoice line. Paint and Paint Accessories are picked
 *  differently (Paint carries stored GST per packing; Accessories never store GST — it's
 *  entered manually per line, defaulting to 0%) so the user first chooses which type of item
 *  they're adding, then gets the matching search-and-pick flow below. */
function ProductPickerPanel({ onAdd }: { onAdd: (line: DraftLine) => void }) {
  const [itemType, setItemType] = useState<"paint" | "accessory">("paint");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["paint", "accessory"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setItemType(t)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              itemType === t
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                : "border-ink-200 text-ink-500 dark:border-ink-700 dark:text-ink-400"
            }`}
          >
            {t === "paint" ? "Paint" : "Paint Accessories"}
          </button>
        ))}
      </div>
      {itemType === "paint" ? <PaintPickerPanel onAdd={onAdd} /> : <AccessoryPickerPanel onAdd={onAdd} />}
    </div>
  );
}

/** Product selection follows Series → Product Name → Packaging. Once a product is picked from
 *  search, this panel lets the user choose which packaging (size) to invoice — selecting a
 *  packaging automatically loads that variant's Retail Price and GST %, per the Allied Paint
 *  price list structure (Company → Category → Series → Product Name → Packaging). */
function PaintPickerPanel({ onAdd }: { onAdd: (line: DraftLine) => void }) {
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [packagingId, setPackagingId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [shadeCode, setShadeCode] = useState("");
  const [shadeName, setShadeName] = useState("");

  const selectedOption = pendingProduct?.packagingOptions.find((o) => o.id === packagingId) ?? null;

  function selectProduct(p: Product) {
    setPendingProduct(p);
    setPackagingId(p.packagingOptions[0]?.id ?? "");
    setQuantity("1");
    setDiscountPercent("0");
    setShadeCode("");
    setShadeName("");
  }

  function handleAdd() {
    if (!pendingProduct || !selectedOption) {
      toast.error("Select a packaging option first.");
      return;
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }
    const line = computeLine({
      rowId: newRowId(),
      productId: pendingProduct.id,
      productName: pendingProduct.productName,
      company: pendingProduct.company,
      category: pendingProduct.category,
      series: pendingProduct.series,
      packing: selectedOption.packing,
      shadeCode: shadeCode.trim() || undefined,
      shadeName: shadeName.trim() || undefined,
      quantity: qty,
      unitPrice: selectedOption.retailPrice,
      discountPercent: Number(discountPercent) || 0,
      discountAmount: 0,
      gstPercent: selectedOption.gst,
      gstAmount: 0,
      lineTotal: 0
    });
    onAdd(line);
    setPendingProduct(null);
    setPackagingId("");
  }

  return (
    <div className="space-y-3">
      <ProductSearchDropdown activeOnly onSelect={selectProduct} />

      {pendingProduct && (
        <div className="space-y-3 rounded-lg border border-ink-100 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Series: {pendingProduct.series || "—"}
              </p>
              <p className="font-medium">Product: {pendingProduct.productName}</p>
            </div>
            <button type="button" onClick={() => setPendingProduct(null)} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Packaging</label>
              <select className="input" value={packagingId} onChange={(e) => setPackagingId(e.target.value)}>
                {pendingProduct.packagingOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.packing}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Retail Price</label>
              <div className="input flex items-center bg-white dark:bg-ink-900">{selectedOption ? money(selectedOption.retailPrice) : "—"}</div>
            </div>
            <div>
              <label className="label">GST %</label>
              <div className="input flex items-center bg-white dark:bg-ink-900">{selectedOption ? `${selectedOption.gst}%` : "—"}</div>
            </div>
            <div>
              <label className="label">Quantity</label>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Shade Code (optional)</label>
              <input className="input" placeholder="e.g. 7015" value={shadeCode} onChange={(e) => setShadeCode(e.target.value)} />
            </div>
            <div>
              <label className="label">Shade Name (optional)</label>
              <input className="input" placeholder="e.g. Vivid Blue" value={shadeName} onChange={(e) => setShadeName(e.target.value)} />
            </div>
            <div>
              <label className="label">Discount %</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                className="input"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>
          </div>

          <button type="button" onClick={handleAdd} className="btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add to Invoice
          </button>
        </div>
      )}
    </div>
  );
}

/** Accessory selection follows Section → Type/Size. Unlike Paint, accessories never carry a
 *  stored GST — the invoice line defaults to 0% GST but stays manually editable, per the
 *  Paint Accessories spec (Section 6). */
function AccessoryPickerPanel({ onAdd }: { onAdd: (line: DraftLine) => void }) {
  const [pendingSection, setPendingSection] = useState<AccessorySection | null>(null);
  const [variantId, setVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [gstPercent, setGstPercent] = useState("0");

  const selectedVariant = pendingSection?.variants.find((v) => v.id === variantId) ?? null;

  function selectSection(s: AccessorySection) {
    setPendingSection(s);
    setVariantId(s.variants[0]?.id ?? "");
    setQuantity("1");
    setDiscountPercent("0");
    setGstPercent("0");
  }

  function handleAdd() {
    if (!pendingSection || !selectedVariant) {
      toast.error("Select a Type/Size first.");
      return;
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }
    const line = computeLine({
      rowId: newRowId(),
      productId: `${pendingSection.id}:${selectedVariant.id}`,
      productName: pendingSection.sectionName,
      company: "",
      category: "Paint Accessories",
      series: "",
      packing: selectedVariant.name,
      quantity: qty,
      unitPrice: selectedVariant.retailPrice,
      discountPercent: Number(discountPercent) || 0,
      discountAmount: 0,
      gstPercent: Number(gstPercent) || 0,
      gstAmount: 0,
      lineTotal: 0
    });
    onAdd(line);
    setPendingSection(null);
    setVariantId("");
  }

  return (
    <div className="space-y-3">
      <AccessorySearchDropdown activeOnly onSelect={selectSection} />

      {pendingSection && (
        <div className="space-y-3 rounded-lg border border-ink-100 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Section: {pendingSection.sectionName}</p>
            </div>
            <button type="button" onClick={() => setPendingSection(null)} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Type / Size</label>
              <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                {pendingSection.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Retail Price</label>
              <div className="input flex items-center bg-white dark:bg-ink-900">{selectedVariant ? money(selectedVariant.retailPrice) : "—"}</div>
            </div>
            <div>
              <label className="label">GST % (manual)</label>
              <input type="number" min="0" max="100" step="0.01" className="input" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
            </div>
            <div>
              <label className="label">Quantity</label>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Discount %</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                className="input"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>
          </div>

          <button type="button" onClick={handleAdd} className="btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add to Invoice
          </button>
        </div>
      )}
    </div>
  );
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

  function addLine(line: DraftLine) {
    setLines((prev) => [...prev, line]);
  }

  function updateLine(rowId: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.rowId === rowId ? computeLine({ ...l, ...patch }) : l)));
  }

  function removeLine(rowId: string) {
    setLines((prev) => prev.filter((l) => l.rowId !== rowId));
  }

  const totals = useMemo(() => {
    return calculateInvoiceTotals(
      lines.map((l) => ({
        gross: l.quantity * l.unitPrice,
        discountAmount: l.discountAmount,
        gstAmount: l.gstAmount
      })),
      { enabled: whtEnabled, percent: whtPercent }
    );
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
          <ProductPickerPanel onAdd={addLine} />
        </div>

        {lines.length > 0 && (
          <>
            {/* Mobile: one card per line item, touch-friendly controls. */}
            <div className="space-y-3 sm:hidden">
              {lines.map((l) => (
                <div key={l.rowId} className="rounded-lg border border-ink-100 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-800">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {l.series && <p className="text-xs text-ink-500 dark:text-ink-400">{l.series}</p>}
                      <p className="truncate font-medium">{l.productName}</p>
                      {(l.shadeCode || l.shadeName) && (
                        <p className="text-xs text-ink-500 dark:text-ink-400">
                          {l.shadeCode ? `Shade Code: ${l.shadeCode}` : ""}
                          {l.shadeCode && l.shadeName ? " · " : ""}
                          {l.shadeName ? `Shade: ${l.shadeName}` : ""}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.rowId)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-swatch-clay hover:bg-swatch-clay/10"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="label !mb-1">Packing</p>
                      <p className="text-sm font-medium">{l.packing || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="label !mb-1">Retail Price</p>
                      <p className="text-sm font-medium">{money(l.unitPrice, currency)}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="label !mb-1">Quantity</p>
                    <QuantityStepper value={String(l.quantity)} onChange={(v) => updateLine(l.rowId, { quantity: Number(v) || 0 })} />
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="label !mb-1">Discount %</p>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.01"
                        className="input"
                        value={l.discountPercent}
                        onChange={(e) => updateLine(l.rowId, { discountPercent: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <p className="label !mb-1">GST %</p>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.01"
                        className="input"
                        value={l.gstPercent}
                        onChange={(e) => updateLine(l.rowId, { gstPercent: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-ink-200 pt-3 dark:border-ink-700">
                    <span className="text-sm text-ink-500 dark:text-ink-400">Amount</span>
                    <span className="text-base font-semibold">{money(l.lineTotal, currency)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / tablet: dense table. */}
            <div className="hidden overflow-x-auto rounded-lg border border-ink-100 dark:border-ink-800 sm:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink-100 bg-ink-50 uppercase tracking-wide text-ink-400 dark:border-ink-800 dark:bg-ink-800">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Series</th>
                    <th className="px-3 py-2">Packaging</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Retail Price</th>
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
                        <p className="text-ink-400">
                          {l.company}
                          {(l.shadeCode || l.shadeName) && (
                            <>
                              {l.company ? " · " : ""}
                              {[l.shadeCode, l.shadeName].filter(Boolean).join(" ")}
                            </>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-2">{l.series || "—"}</td>
                      <td className="px-3 py-2">{l.packing || "—"}</td>
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
          </>
        )}
        {lines.length === 0 && <p className="text-sm text-ink-400">Search a product above, choose its packaging, then add it as a line item.</p>}
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
                inputMode="decimal"
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
            <span className="text-ink-500 dark:text-ink-400">After Discount</span>
            <span>{money(totals.valueAfterDiscount, currency)}</span>
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
          <div className="flex justify-between border-t border-ink-100 pt-2 text-lg font-semibold dark:border-ink-800">
            <span>GRAND TOTAL</span>
            <span className="text-brand-600 dark:text-brand-300">{money(totals.grandTotal, currency)}</span>
          </div>

          <button onClick={handleGenerate} disabled={saving} className="btn-primary mt-4 w-full py-3 text-base">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Saving Invoice…" : "Save Invoice"}
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
