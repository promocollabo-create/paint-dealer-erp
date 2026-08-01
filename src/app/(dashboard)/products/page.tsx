"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";
import { Loader2, Plus, History, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProductSearchDropdown from "@/components/products/ProductSearchDropdown";
import ProductFormModal from "@/components/products/ProductFormModal";
import { useProductSearch } from "@/lib/hooks/useProductSearch";
import { PRODUCT_CATEGORIES, Product } from "@/types";
import toast from "react-hot-toast";

function money(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

function ProductsContent() {
  const [category, setCategory] = useState<string>("all");
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

  // Empty term = most recently updated 50 products; smart search kicks in once the admin types.
  const { results, loading } = useProductSearch("", { refreshKey });

  const filtered = useMemo(() => {
    return results.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [results, category, statusFilter]);

  return (
    <main className="flex-1 space-y-4 p-5">
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
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <p className="text-xs text-ink-400">
        Showing the 50 most recently updated products. Use search above to find anything in the full catalog.
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3">Packing</th>
              <th className="px-5 py-3 text-right">MRP</th>
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
                  No products match these filters yet.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 font-medium">{p.productName}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-500">{p.productCode}</td>
                  <td className="px-5 py-3">{p.category}</td>
                  <td className="px-5 py-3">{p.company || "—"}</td>
                  <td className="px-5 py-3">{p.packing || "—"}</td>
                  <td className="px-5 py-3 text-right">{money(p.mrp)}</td>
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
