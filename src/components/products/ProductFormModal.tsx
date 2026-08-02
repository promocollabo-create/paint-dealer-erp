"use client";

import { useState } from "react";
import { addDoc, collection, doc, getDocs, limit as fsLimit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { Product } from "@/types";
import { generateSearchTokens } from "@/lib/search";
import toast from "react-hot-toast";

/** Paint products no longer expose a Category picker in the UI — every Paint product added
 *  through this form is stored under the fixed "Paint" category so it stays separate from
 *  Paint Accessories (which live in their own `accessorySections` collection entirely). */
const PAINT_CATEGORY = "Paint";

interface PackagingRow {
  id: string;
  packing: string;
  retailPrice: string;
  gst: string;
}

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `pkg-${Date.now()}-${idCounter}`;
}

function emptyPackagingRow(): PackagingRow {
  return { id: newId(), packing: "", retailPrice: "0", gst: "0" };
}

const EMPTY_FORM = {
  company: "",
  category: PAINT_CATEGORY,
  series: "",
  productName: "",
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
          status: editing.status
        }
      : EMPTY_FORM
  );
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>(
    editing && editing.packagingOptions.length > 0
      ? editing.packagingOptions.map((o) => ({ id: o.id, packing: o.packing, retailPrice: String(o.retailPrice), gst: String(o.gst) }))
      : [emptyPackagingRow()]
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updatePackagingRow(id: string, patch: Partial<PackagingRow>) {
    setPackagingRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addPackagingRow() {
    setPackagingRows((rows) => [...rows, emptyPackagingRow()]);
  }

  function removePackagingRow(id: string) {
    setPackagingRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return; // guard against a double-click firing two submits
    setSaving(true);
    try {
      const productName = form.productName.trim();
      const company = form.company.trim();
      const series = form.series.trim();

      const packagingOptions = packagingRows
        .filter((r) => r.packing.trim().length > 0)
        .map((r) => ({ id: r.id, packing: r.packing.trim(), retailPrice: Number(r.retailPrice) || 0, gst: Number(r.gst) || 0 }));

      if (!productName) {
        toast.error("Product Name is required.");
        setSaving(false);
        return;
      }
      if (packagingOptions.length === 0) {
        toast.error("Add at least one packaging option with a Retail Price.");
        setSaving(false);
        return;
      }

      const payload = {
        company,
        category: form.category,
        series,
        productName,
        packagingOptions,
        status: form.status,
        searchTokens: generateSearchTokens({ productName, category: form.category, series, company })
      };

      // Duplicate check by Company + Category + Series + Product Name (excluding the record being edited).
      const dupeSnap = await getDocs(
        query(
          collection(db, "products"),
          where("company", "==", company),
          where("category", "==", form.category),
          where("series", "==", series),
          where("productName", "==", productName),
          fsLimit(2)
        )
      );
      const dupeExists = dupeSnap.docs.some((d) => d.id !== editing?.id);
      if (dupeExists) {
        toast.error(`A product with this Company, Category, Series and Product Name already exists.`);
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
    <div className="modal-overlay">
      <div className="modal-panel sm:max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{editing ? "Edit Paint Product" : "Add Paint Product"}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Brand</label>
            <input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Allied Paint Industries" />
          </div>

          <div>
            <label className="label">Series</label>
            <input className="input" value={form.series} onChange={(e) => set("series", e.target.value)} />
          </div>

          <div>
            <label className="label">Product Name</label>
            <input className="input" required value={form.productName} onChange={(e) => set("productName", e.target.value)} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label !mb-0">Packaging Options</label>
              <button type="button" onClick={addPackagingRow} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add Packaging
              </button>
            </div>
            <div className="space-y-2">
              {packagingRows.map((row) => (
                <div key={row.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_0.7fr_auto]">
                  <div>
                    <label className="label">Packaging</label>
                    <input
                      className="input"
                      placeholder="e.g. Qtr, Gln, Drm"
                      value={row.packing}
                      onChange={(e) => updatePackagingRow(row.id, { packing: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Retail Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={row.retailPrice}
                      onChange={(e) => updatePackagingRow(row.id, { retailPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">GST %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={row.gst}
                      onChange={(e) => updatePackagingRow(row.id, { gst: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePackagingRow(row.id)}
                    disabled={packagingRows.length === 1}
                    className="mb-0.5 p-2 text-ink-400 hover:text-swatch-clay disabled:opacity-30"
                    aria-label="Remove packaging option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
