"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/types";
import { normalizeQueryWords } from "@/lib/search";

function mapDoc(d: any): Product {
  const data = d.data();
  return {
    id: d.id,
    company: data.company ?? "",
    category: data.category ?? "",
    series: data.series ?? "",
    productName: data.productName ?? "",
    packagingOptions: Array.isArray(data.packagingOptions)
      ? data.packagingOptions.map((o: any) => ({
          id: o.id ?? "",
          packing: o.packing ?? "",
          retailPrice: o.retailPrice ?? 0,
          gst: o.gst ?? 0
        }))
      : [],
    status: data.status ?? "active",
    source: data.source ?? "manual",
    currentPriceListVersionId: data.currentPriceListVersionId ?? null,
    searchTokens: data.searchTokens ?? [],
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now()
  };
}

export function useProductSearch(rawTerm: string, opts: { activeOnly?: boolean; refreshKey?: number | string } = {}) {
  const { activeOnly = false, refreshKey } = opts;
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const term = rawTerm.trim();

    async function run() {
      setLoading(true);
      try {
        let docs: any[] = [];

        if (!term) {
          const snap = await getDocs(query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(50)));
          docs = snap.docs;
        } else {
          const words = normalizeQueryWords(term);
          const firstToken = words[0];
          const snap = await getDocs(
            query(collection(db, "products"), where("searchTokens", "array-contains", firstToken), limit(50))
          );
          docs = snap.docs;

          // Refine client-side for any additional words the user typed.
          if (words.length > 1) {
            docs = docs.filter((d) => {
              const p = mapDoc(d);
              const haystack = `${p.productName} ${p.category} ${p.series} ${p.company}`.toLowerCase();
              return words.every((w) => haystack.includes(w));
            });
          }
        }

        let mapped = docs.map(mapDoc);
        if (activeOnly) mapped = mapped.filter((p) => p.status === "active");

        if (!cancelled) setResults(mapped);
      } catch (e) {
        console.error(e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const handle = setTimeout(run, 200); // debounce as-you-type queries
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [rawTerm, activeOnly, refreshKey]);

  return { results, loading };
}
