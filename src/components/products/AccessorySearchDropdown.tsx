"use client";

import { useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useAccessorySearch } from "@/lib/hooks/useAccessorySearch";
import { AccessorySection } from "@/types";

export default function AccessorySearchDropdown({
  placeholder = "Search by section name (Brush, Roller, Patra...)",
  activeOnly = false,
  onSelect
}: {
  placeholder?: string;
  activeOnly?: boolean;
  onSelect: (section: AccessorySection) => void;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const { results, loading } = useAccessorySearch(term, { activeOnly });
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
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />}

      {open && (term.length > 0 || results.length > 0) && (
        <div className="absolute z-40 mt-1.5 max-h-80 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-800">
          {results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-ink-400">No matching accessory sections.</p>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(s);
                  setTerm("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.sectionName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">
                    {s.variants.length} {s.variants.length === 1 ? "type" : "types"}
                  </p>
                  {s.status === "inactive" && <span className="badge bg-ink-100 text-ink-500 dark:bg-ink-700">Inactive</span>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
