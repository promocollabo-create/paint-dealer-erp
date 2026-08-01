"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { Loader2, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { Customer } from "@/types";

export default function CustomerSearchDropdown({
  placeholder = "Search customer by name, phone, or ID",
  onSelect
}: {
  placeholder?: string;
  onSelect: (customer: Customer) => void;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "customers"), orderBy("name"), limit(500)));
        if (cancelled) return;
        setAll(
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
            } as Customer;
          })
        );
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = (() => {
    const t = term.trim().toLowerCase();
    if (!t) return all.slice(0, 20);
    return all
      .filter(
        (c) =>
          c.name.toLowerCase().includes(t) || c.phone.toLowerCase().includes(t) || c.customerCode.toLowerCase().includes(t)
      )
      .slice(0, 20);
  })();

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        className="input pl-9"
        placeholder={placeholder}
        value={term}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />}

      {open && (
        <div className="absolute z-40 mt-1.5 max-h-72 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-800">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-ink-400">No matching customers.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(c);
                  setTerm("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                    {c.customerCode} · {c.phone}
                  </p>
                </div>
                {c.outstanding > 0 && (
                  <span className="shrink-0 text-xs font-medium text-swatch-clay">
                    Due {c.outstanding.toLocaleString("en-PK")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
