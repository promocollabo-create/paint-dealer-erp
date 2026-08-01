"use client";

import { useState } from "react";
import { addDoc, collection, doc, getDocs, limit as fsLimit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { AccessorySection } from "@/types";
import { generateSearchTokens } from "@/lib/search";
import toast from "react-hot-toast";

interface VariantRow {
  id: string;
  name: string;
  retailPrice: string;
}

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `acc-${Date.now()}-${idCounter}`;
}

function emptyVariantRow(): VariantRow {
  return { id: newId(), name: "", retailPrice: "0" };
}

const EMPTY_FORM = {
  sectionName: "",
  status: "active" as "active" | "inactive"
};

/** Paint Accessories work differently from Paint products: no Brand/Series/Packing hierarchy —
 *  just a free-text Section Name (Brush, Roller, Patra, ...) chosen entirely by the user, each
 *  holding any number of free-text Type/Size variants with their own Retail Price. Accessories
 *  never carry a stored GST — GST is entered manually per invoice line at 0% by default. */
export default function AccessoryFormModal({
  editing,
  onClose,
  onSaved
}: {
  editing: AccessorySection | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    editing ? { sectionName: editing.sectionName, status: editing.status } : EMPTY_FORM
  );
  const [variantRows, setVariantRows] = useState<VariantRow[]>(
    editing && editing.variants.length > 0
      ? editing.variants.map((v) => ({ id: v.id, name: v.name, retailPrice: String(v.retailPrice) }))
      : [emptyVariantRow()]
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateVariantRow(id: string, patch: Partial<VariantRow>) {
    setVariantRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addVariantRow() {
    setVariantRows((rows) => [...rows, emptyVariantRow()]);
  }

  function removeVariantRow(id: string) {
    setVariantRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const sectionName = form.sectionName.trim();

      const variants = variantRows
        .filter((r) => r.name.trim().length > 0)
        .map((r) => ({ id: r.id, name: r.name.trim(), retailPrice: Number(r.retailPrice) || 0 }));

      if (!sectionName) {
        toast.error("Section Name is required.");
        setSaving(false);
        return;
      }
      if (variants.length === 0) {
        toast.error("Add at least one Type/Size with a Retail Price.");
        setSaving(false);
        return;
      }

      const payload = {
        sectionName,
        variants,
        status: form.status,
        searchTokens: generateSearchTokens({ productName: sectionName, category: "Paint Accessories", series: "", company: "" })
      };

      // Duplicate check by Section Name (excluding the record being edited).
      const dupeSnap = await getDocs(
        query(collection(db, "accessorySections"), where("sectionName", "==", sectionName), fsLimit(2))
      );
      const dupeExists = dupeSnap.docs.some((d) => d.id !== editing?.id);
      if (dupeExists) {
        toast.error(`An Accessory Section named "${sectionName}" already exists.`);
        setSaving(false);
        return;
      }

      if (editing) {
        await updateDoc(doc(db, "accessorySections", editing.id), { ...payload, updatedAt: serverTimestamp() });
        toast.success("Accessory section updated");
      } else {
        await addDoc(collection(db, "accessorySections"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Accessory section added");
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not save accessory section. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{editing ? "Edit Accessory Section" : "Add Accessory Section"}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Section Name</label>
            <input
              className="input"
              required
              value={form.sectionName}
              onChange={(e) => set("sectionName", e.target.value)}
              placeholder="e.g. Brush, Roller, Patra, Sandpaper, Tape"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label !mb-0">Type / Size Variants</label>
              <button type="button" onClick={addVariantRow} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add Type / Size
              </button>
            </div>
            <div className="space-y-2">
              {variantRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <div>
                    <label className="label">Type / Size</label>
                    <input
                      className="input"
                      placeholder="e.g. 1 Inch, Small, No. 120, 500 ml"
                      value={row.name}
                      onChange={(e) => updateVariantRow(row.id, { name: e.target.value })}
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
                      onChange={(e) => updateVariantRow(row.id, { retailPrice: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariantRow(row.id)}
                    disabled={variantRows.length === 1}
                    className="mb-0.5 p-2 text-ink-400 hover:text-swatch-clay disabled:opacity-30"
                    aria-label="Remove variant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-400">
              GST is not stored here — it's entered manually per invoice line, defaulting to 0%.
            </p>
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
              {editing ? "Save Changes" : "Add Section"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
