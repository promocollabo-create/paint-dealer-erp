"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";
import { Loader2, Plus, History, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProductSearchDropdown from "@/components/products/ProductSearchDropdown";
import ProductFormModal from "@/components/products/ProductFormModal";
import AccessorySearchDropdown from "@/components/products/AccessorySearchDropdown";
import AccessoryFormModal from "@/components/products/AccessoryFormModal";
import { useProductSearch } from "@/lib/hooks/useProductSearch";
import { useAccessorySearch } from "@/lib/hooks/useAccessorySearch";
import { AccessorySection, Product } from "@/types";
import toast from "react-hot-toast";

function money(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

/* ------------------------------ Paint Products tab ------------------------------ */

function PaintProductsTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(p: Product) {
    if (!window.confirm(`Delete "${p.productName}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      await deleteDoc(doc(db, "products", p.id));
      toast.success("Product deleted");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Could not delete product.");
    } finally {
      setDeletingId(null);
    }
  }

  const { results, loading } = useProductSearch("", { refreshKey });

  const filtered = useMemo(() => {
    return results.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [results, statusFilter]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md flex-1">
          <ProductSearchDropdown
            onSelect={(p) => {
              setEditing(p);
              setModalOpen(true);
            }}
          />
        </div>
        <div className="flex gap-2">
          <Link href="/products/price-list" className="btn-secondary">
            <History className="h-4 w-4" /> Price Lists
          </Link>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Add Paint Product
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <p className="text-xs text-ink-400">
        Showing the 50 most recently updated Paint products. Use search above to find anything in the full catalog.
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Brand</th>
              <th className="px-5 py-3">Series</th>
              <th className="px-5 py-3">Packing</th>
              <th className="px-5 py-3 text-right">Retail Price</th>
              <th className="px-5 py-3">GST</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-400">
                  No Paint products match these filters yet.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 font-medium">{p.productName}</td>
                  <td className="px-5 py-3">{p.company || "—"}</td>
                  <td className="px-5 py-3">{p.series || "—"}</td>
                  <td className="px-5 py-3">
                    {p.packagingOptions.length > 0 ? p.packagingOptions.map((o) => o.packing).join(", ") : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.packagingOptions.length > 0
                      ? p.packagingOptions.length === 1
                        ? money(p.packagingOptions[0].retailPrice)
                        : `${money(Math.min(...p.packagingOptions.map((o) => o.retailPrice)))} – ${money(
                            Math.max(...p.packagingOptions.map((o) => o.retailPrice))
                          )}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {p.packagingOptions.length > 0
                      ? Array.from(new Set(p.packagingOptions.map((o) => `${o.gst}%`))).join(", ")
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${
                        p.status === "active"
                          ? "bg-swatch-moss/10 text-swatch-moss"
                          : "bg-ink-100 text-ink-500 dark:bg-ink-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        className="text-ink-400 hover:text-swatch-clay disabled:opacity-50"
                        aria-label="Delete product"
                      >
                        {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ProductFormModal editing={editing} onClose={() => setModalOpen(false)} onSaved={() => setRefreshKey((k) => k + 1)} />
      )}
    </>
  );
}

/* ------------------------------ Paint Accessories tab ------------------------------ */

function PaintAccessoriesTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccessorySection | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(s: AccessorySection) {
    if (!window.confirm(`Delete section "${s.sectionName}"? This cannot be undone.`)) return;
    setDeletingId(s.id);
    try {
      await deleteDoc(doc(db, "accessorySections", s.id));
      toast.success("Accessory section deleted");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Could not delete accessory section.");
    } finally {
      setDeletingId(null);
    }
  }

  const { results, loading } = useAccessorySearch("", { refreshKey });

  const filtered = useMemo(() => {
    return results.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [results, statusFilter]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md flex-1">
          <AccessorySearchDropdown
            onSelect={(s) => {
              setEditing(s);
              setModalOpen(true);
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Add Accessory Section
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <p className="text-xs text-ink-400">
        Showing the 50 most recently updated Accessory sections. GST for accessories is entered manually on each invoice line.
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">Section</th>
              <th className="px-5 py-3">Type / Size</th>
              <th className="px-5 py-3 text-right">Retail Price</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-400">
                  No Accessory sections match these filters yet.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 font-medium">{s.sectionName}</td>
                  <td className="px-5 py-3">{s.variants.length > 0 ? s.variants.map((v) => v.name).join(", ") : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {s.variants.length > 0
                      ? s.variants.length === 1
                        ? money(s.variants[0].retailPrice)
                        : `${money(Math.min(...s.variants.map((v) => v.retailPrice)))} – ${money(
                            Math.max(...s.variants.map((v) => v.retailPrice))
                          )}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`badge ${
                        s.status === "active"
                          ? "bg-swatch-moss/10 text-swatch-moss"
                          : "bg-ink-100 text-ink-500 dark:bg-ink-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setEditing(s);
                          setModalOpen(true);
                        }}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        className="text-ink-400 hover:text-swatch-clay disabled:opacity-50"
                        aria-label="Delete accessory section"
                      >
                        {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <AccessoryFormModal editing={editing} onClose={() => setModalOpen(false)} onSaved={() => setRefreshKey((k) => k + 1)} />
      )}
    </>
  );
}

/* ------------------------------ Page shell ------------------------------ */

function ProductsContent() {
  const [tab, setTab] = useState<"paint" | "accessories">("paint");

  return (
    <main className="flex-1 space-y-4 p-5">
      <div className="flex gap-2 border-b border-ink-100 dark:border-ink-800">
        <button
          onClick={() => setTab("paint")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === "paint" ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-transparent text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          }`}
        >
          Paint Products
        </button>
        <button
          onClick={() => setTab("accessories")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === "accessories" ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-transparent text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          }`}
        >
          Paint Accessories
        </button>
      </div>

      {tab === "paint" ? <PaintProductsTab /> : <PaintAccessoriesTab />}
    </main>
  );
}

export default function ProductsPage() {
  return (
    <>
      <Topbar title="Products" />
      <ProductsContent />
    </>
  );
}
