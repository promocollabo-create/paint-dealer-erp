"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Loader2, Upload } from "lucide-react";
import { db, storage, getMissingFirebaseEnvVars } from "@/lib/firebase";
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

// Accepted logo formats — kept in one place so the <input accept="..."> attribute and the
// actual runtime validation (accept is only a hint; browsers don't enforce it) always agree.
const ACCEPTED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function SettingsForm() {
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    // Always clear the input value so selecting the exact same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    // 1. Fail fast, with a specific message, if the build is missing Firebase config —
    //    this is the #1 cause of uploads silently going nowhere.
    const missingVars = getMissingFirebaseEnvVars();
    if (missingVars.length > 0) {
      toast.error(`Firebase isn't configured: missing ${missingVars.join(", ")}. Set these and rebuild/redeploy.`);
      console.error("Logo upload aborted — missing Firebase env vars:", missingVars);
      return;
    }
    if (!storage) {
      toast.error("Firebase Storage failed to initialize. Check the browser console for details.");
      return;
    }

    // 2. Validate type against the real MIME type (accept="" on the input is only a hint —
    //    browsers/file pickers don't actually enforce it).
    const extension = ACCEPTED_LOGO_TYPES[file.type];
    if (!extension) {
      toast.error("Logo must be a PNG, JPG/JPEG, or WEBP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo must be under 2MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      // Suggested path from the spec: shop-settings/logo/current-logo-{timestamp}.{extension}
      const storagePath = `shop-settings/logo/current-logo-${Date.now()}.${extension}`;
      const storageRef = ref(storage, storagePath);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

      const url = await new Promise<string>((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          (error) => reject(error),
          async () => {
            try {
              resolve(await getDownloadURL(task.snapshot.ref));
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      // Update the form immediately for preview...
      update("logoUrl", url);

      // ...and ALSO persist it to Firestore right away (merge, not the whole form) so the
      // logo survives a refresh/logout/new device even if the admin never presses
      // "Save Settings" afterward. This was the actual bug: previously the upload only
      // updated local React state, so navigating away or refreshing before clicking Save
      // silently discarded the uploaded logo even though the file WAS in Storage.
      await setDoc(doc(db, "settings", "shop"), { logoUrl: url, updatedAt: serverTimestamp() }, { merge: true });

      toast.success("Logo uploaded and saved.");
    } catch (err: any) {
      // Surface the real Firebase error code/message instead of a generic failure — needed
      // to tell apart storage/unauthorized (rules), storage/bucket-not-found (bad env var),
      // storage/unknown (network/CORS), etc.
      const code = err?.code ?? "unknown";
      const message = err?.message ?? String(err);
      console.error("Logo upload failed:", code, message, err);
      if (code === "storage/unauthorized") {
        toast.error("Upload blocked by Storage rules (storage/unauthorized) — your account may not have the admin role.");
      } else if (code === "storage/bucket-not-found" || code === "storage/project-not-found") {
        toast.error(`Upload failed: ${code}. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET matches your Firebase project.`);
      } else if (code === "storage/canceled") {
        toast.error("Upload canceled.");
      } else {
        toast.error(`Logo upload failed: ${code} — ${message}`);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "shop"), { ...form, updatedAt: serverTimestamp() }, { merge: true });
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
              <div>
                <label className="btn-secondary cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {uploading ? `Uploading… ${uploadProgress}%` : "Upload logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                    disabled={uploading}
                  />
                </label>
                <p className="mt-1 text-xs text-ink-400">PNG, JPG, or WEBP · up to 2MB</p>
              </div>
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
