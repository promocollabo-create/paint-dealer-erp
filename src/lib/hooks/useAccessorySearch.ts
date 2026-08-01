"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccessorySection } from "@/types";
import { normalizeQueryWords } from "@/lib/search";

function mapDoc(d: any): AccessorySection {
  const data = d.data();
  return {
    id: d.id,
    sectionName: data.sectionName ?? "",
    variants: Array.isArray(data.variants)
      ? data.variants.map((v: any) => ({ id: v.id ?? "", name: v.name ?? "", retailPrice: v.retailPrice ?? 0 }))
      : [],
    status: data.status ?? "active",
    searchTokens: data.searchTokens ?? [],
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now()
  };
}

/** Same "search as you type" pattern as useProductSearch, but against the accessorySections
 *  collection — Sections search by Section Name (and, client-side, by their variant names). */
export function useAccessorySearch(rawTerm: string, opts: { activeOnly?: boolean; refreshKey?: number | string } = {}) {
  const { activeOnly = false, refreshKey } = opts;
  const [results, setResults] = useState<AccessorySection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const term = rawTerm.trim();

    async function run() {
      setLoading(true);
      try {
        let docs: any[] = [];

        if (!term) {
          const snap = await getDocs(query(collection(db, "accessorySections"), orderBy("updatedAt", "desc"), limit(50)));
          docs = snap.docs;
        } else {
          const words = normalizeQueryWords(term);
          const firstToken = words[0];
          const snap = await getDocs(
            query(collection(db, "accessorySections"), where("searchTokens", "array-contains", firstToken), limit(50))
          );
          docs = snap.docs;

          if (words.length > 1) {
            docs = docs.filter((d) => {
              const s = mapDoc(d);
              const haystack = `${s.sectionName} ${s.variants.map((v) => v.name).join(" ")}`.toLowerCase();
              return words.every((w) => haystack.includes(w));
            });
          }
        }

        let mapped = docs.map(mapDoc);
        if (activeOnly) mapped = mapped.filter((s) => s.status === "active");

        if (!cancelled) setResults(mapped);
      } catch (e) {
        console.error(e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const handle = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [rawTerm, activeOnly, refreshKey]);

  return { results, loading };
}
