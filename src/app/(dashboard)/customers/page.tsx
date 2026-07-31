"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { Loader2, Plus, Search, X } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Customer } from "@/types";
import toast from "react-hot-toast";

const EMPTY_FORM = { name: "", phone: "", address: "", city: "", creditLimit: "0", notes: "" };

function money(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function CustomerModal({
  onClose,
  onSaved,
  editing
}: {
  onClose: () => void;
  onSaved: () => void;
  editing: Customer | null;
}) {
  const [form, setForm] = useState(
    editing
      ? {
          name: editing.name,
          phone: editing.phone,
          address: editing.address,
          city: editing.city,
          creditLimit: String(editing.creditLimit ?? 0),
          notes: editing.notes ?? ""
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        creditLimit: Number(form.creditLimit) || 0,
        notes: form.notes.trim()
      };

      if (editing) {
        await updateDoc(doc(db, "customers", editing.id), { ...payload, updatedAt: serverTimestamp() });
        toast.success("Customer updated");
      } else {
        const countSnap = await getCountFromServer(collection(db, "customers"));
        const customerCode = `CUST-${String(countSnap.data().count + 1).padStart(4, "0")}`;
        await addDoc(collection(db, "customers"), {
          ...payload,
          customerCode,
          outstanding: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Customer added");
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div className="card w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{editing ? "Edit Customer" : "Add Customer"}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Credit Limit</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.creditLimit}
              onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-20"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save Changes" : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  useEffect(() => {
    const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCustomers(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              customerCode: data.customerCode ?? "—",
              name: data.name ?? "",
              phone: data.phone ?? "",
              address: data.address ?? "",
              city: data.city ?? "",
              creditLimit: data.creditLimit ?? 0,
              outstanding: data.outstanding ?? 0,
              notes: data.notes ?? "",
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() ?? Date.now()
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.customerCode.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term)
    );
  }, [customers, search]);

  return (
    <main className="flex-1 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, phone, city, or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">City</th>
              <th className="px-5 py-3 text-right">Credit Limit</th>
              <th className="px-5 py-3 text-right">Outstanding</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                  {search ? "No customers match your search." : "No customers yet — add your first one."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <td className="px-5 py-3 font-mono text-xs text-ink-500">{c.customerCode}</td>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3">{c.phone}</td>
                  <td className="px-5 py-3">{c.city || "—"}</td>
                  <td className="px-5 py-3 text-right">{money(c.creditLimit)}</td>
                  <td className={`px-5 py-3 text-right font-medium ${c.outstanding > 0 ? "text-swatch-clay" : "text-swatch-moss"}`}>
                    {money(c.outstanding)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <CustomerModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {}}
        />
      )}
    </main>
  );
}

export default function CustomersPage() {
  return (
    <ProtectedRoute requiredPermission="customers.manage">
      <Topbar title="Customers" />
      <CustomersContent />
    </ProtectedRoute>
  );
}
