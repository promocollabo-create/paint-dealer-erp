"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Loader2, Upload } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import toast from "react-hot-toast";

const CURRENCIES = ["PKR", "USD", "AED", "SAR", "GBP", "EUR"];

const EMPTY_SETTINGS = {
  shopName: "",
  logoUrl: "",
  address: "",
  phone: "",
  email: "",
  ntnStrn: "",
  invoicePrefix: "INV-",
  currency: "PKR"
};

function SettingsForm() {
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "shop"));
        if (snap.exists()) {
          setForm({ ...EMPTY_SETTINGS, ...(snap.data() as any) });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function update<K extends keyof typeof EMPTY_SETTINGS>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB.");
      return;
    }
    setUploading(true);
    try {
      const storageRef = ref(storage, `shop/logo-${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      update("logoUrl", url);
      toast.success("Logo uploaded — remember to save.");
    } catch (err) {
      console.error(err);
      toast.error("Logo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "shop"), { ...form, updatedAt: serverTimestamp() });
      toast.success("Shop settings saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <main className="flex-1 p-5">
      <div className="card max-w-2xl">
        <h2 className="mb-1 font-display text-base font-semibold">Shop Profile</h2>
        <p className="mb-5 text-sm text-ink-500 dark:text-ink-400">
          This appears on printed invoices and the customer portal.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="label">Shop Logo</label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink-300 bg-ink-50 dark:border-ink-700 dark:bg-ink-800">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="Shop logo" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-ink-400" />
                )}
              </div>
              <label className="btn-secondary cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {uploading ? "Uploading…" : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Shop Name</label>
              <input className="input" value={form.shopName} onChange={(e) => update("shopName", e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div>
              <label className="label">NTN / STRN</label>
              <input className="input" value={form.ntnStrn} onChange={(e) => update("ntnStrn", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Invoice Prefix</label>
              <input className="input" value={form.invoicePrefix} onChange={(e) => update("invoicePrefix", e.target.value)} placeholder="INV-" />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Settings
          </button>
        </form>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Shop Settings" />
      <SettingsForm />
    </>
  );
}
