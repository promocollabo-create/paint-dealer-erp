"use client";

import { useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useProductSearch } from "@/lib/hooks/useProductSearch";
import { Product } from "@/types";

export default function ProductSearchDropdown({
  placeholder = "Search by product name, category, series, or company",
  activeOnly = false,
  onSelect
}: {
  placeholder?: string;
  activeOnly?: boolean;
  onSelect: (product: Product) => void;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const { results, loading } = useProductSearch(term, { activeOnly });
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

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
          // slight delay so a click on a dropdown item registers before it unmounts
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />}

      {open && (term.length > 0 || results.length > 0) && (
        <div className="absolute z-40 mt-1.5 max-h-80 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-800">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-ink-400">No matching products.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep input focus so onBlur doesn't race the click
                onClick={() => {
                  onSelect(p);
                  setTerm("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.productName}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                    {p.category}
                    {p.series ? ` · ${p.series}` : ""}
                    {p.company ? ` · ${p.company}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">
                    {p.packagingOptions.length} {p.packagingOptions.length === 1 ? "size" : "sizes"}
                  </p>
                  {p.status === "inactive" && <span className="badge bg-ink-100 text-ink-500 dark:bg-ink-700">Inactive</span>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
