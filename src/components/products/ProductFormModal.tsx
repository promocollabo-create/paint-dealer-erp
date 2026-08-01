"use client";

import { useState } from "react";
import { addDoc, collection, doc, getDocs, limit as fsLimit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Loader2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS, Product } from "@/types";
import { generateSearchTokens } from "@/lib/search";
import toast from "react-hot-toast";

const EMPTY_FORM = {
  company: "",
  category: PRODUCT_CATEGORIES[0] as string,
  series: "",
  productName: "",
  productCode: "",
  packing: "",
  colorName: "",
  shadeCode: "",
  retailPrice: "0",
  gst: "0",
  mrp: "0",
  unit: PRODUCT_UNITS[0] as string,
  status: "active" as "active" | "inactive"
};

export default function ProductFormModal({
  editing,
  onClose,
  onSaved
}: {
  editing: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    editing
      ? {
          company: editing.company,
          category: editing.category,
          series: editing.series,
          productName: editing.productName,
          productCode: editing.productCode,
          packing: editing.packing,
          colorName: editing.colorName,
          shadeCode: editing.shadeCode,
          retailPrice: String(editing.retailPrice),
          gst: String(editing.gst),
          mrp: String(editing.mrp),
          unit: editing.unit || (PRODUCT_UNITS[0] as string),
          status: editing.status
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return; // guard against a double-click firing two submits (was creating duplicate products)
    setSaving(true);
    try {
      const payload = {
        company: form.company.trim(),
        category: form.category,
        series: form.series.trim(),
        productName: form.productName.trim(),
        productCode: form.productCode.trim(),
        packing: form.packing.trim(),
        colorName: form.colorName.trim(),
        shadeCode: form.shadeCode.trim(),
        retailPrice: Number(form.retailPrice) || 0,
        gst: Number(form.gst) || 0,
        mrp: Number(form.mrp) || 0,
        unit: form.unit,
        status: form.status,
        searchTokens: generateSearchTokens({
          productName: form.productName,
          productCode: form.productCode,
          category: form.category,
          series: form.series,
          company: form.company
        })
      };

      if (!payload.productName || !payload.productCode) {
        toast.error("Product name and code are required.");
        setSaving(false);
        return;
      }

      // Duplicate check by product code (excluding the record being edited).
      const dupeSnap = await getDocs(
        query(collection(db, "products"), where("productCode", "==", payload.productCode), fsLimit(2))
      );
      const dupeExists = dupeSnap.docs.some((d) => d.id !== editing?.id);
      if (dupeExists) {
        toast.error(`Product code "${payload.productCode}" is already in use.`);
        setSaving(false);
        return;
      }

      if (editing) {
        await updateDoc(doc(db, "products", editing.id), { ...payload, updatedAt: serverTimestamp() });
        toast.success("Product updated");
      } else {
        await addDoc(collection(db, "products"), {
          ...payload,
          source: "manual",
          currentPriceListVersionId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Product added");
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not save product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{editing ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Product Name</label>
            <input className="input" required value={form.productName} onChange={(e) => set("productName", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product Code</label>
              <input className="input" required value={form.productCode} onChange={(e) => set("productCode", e.target.value)} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div>
              <label className="label">Series</label>
              <input className="input" value={form.series} onChange={(e) => set("series", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Color Name</label>
              <input className="input" value={form.colorName} onChange={(e) => set("colorName", e.target.value)} />
            </div>
            <div>
              <label className="label">Shade Code</label>
              <input className="input" value={form.shadeCode} onChange={(e) => set("shadeCode", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Packing</label>
              <input className="input" value={form.packing} onChange={(e) => set("packing", e.target.value)} placeholder="e.g. 4 Ltr" />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {PRODUCT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Retail Price</label>
              <input type="number" min="0" step="0.01" className="input" value={form.retailPrice} onChange={(e) => set("retailPrice", e.target.value)} />
            </div>
            <div>
              <label className="label">GST %</label>
              <input type="number" min="0" step="0.01" className="input" value={form.gst} onChange={(e) => set("gst", e.target.value)} />
            </div>
            <div>
              <label className="label">MRP</label>
              <input type="number" min="0" step="0.01" className="input" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition ${
                    form.status === s
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                      : "border-ink-200 text-ink-500 dark:border-ink-700 dark:text-ink-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
