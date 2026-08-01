export type PriceListField = "company" | "category" | "series" | "productName" | "packing" | "retailPrice" | "gst";

export const FIELD_LABELS: Record<PriceListField, string> = {
  company: "Company",
  category: "Category",
  series: "Series",
  productName: "Product Name",
  packing: "Packaging",
  retailPrice: "Retail Price (RP)",
  gst: "GST %"
};

// Ordered by specificity — longer/more-specific aliases first so a looser match doesn't
// accidentally swallow a more specific column.
const FIELD_ALIASES: Record<PriceListField, string[]> = {
  productName: ["product name", "product", "item name", "item", "description"],
  company: ["company", "brand", "manufacturer"],
  category: ["category", "cat"],
  series: ["series", "range", "collection"],
  packing: ["packaging", "packing", "pack size", "pack", "size"],
  retailPrice: ["retail price", "rp", "trade price", "dealer price", "net price"],
  gst: ["gst", "tax", "sales tax", "gst%", "gst %"]
};

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

/** Given the raw header row from an Excel sheet or a detected PDF table, returns a best-guess
 *  mapping from column index -> price list field. Unmatched columns are omitted so the review
 *  UI can prompt the admin to map them manually. */
export function autoMapColumns(headers: string[]): Partial<Record<PriceListField, number>> {
  const mapping: Partial<Record<PriceListField, number>> = {};
  const normalizedHeaders = headers.map(normalize);
  const claimed = new Set<number>();

  (Object.keys(FIELD_ALIASES) as PriceListField[]).forEach((field) => {
    const aliases = FIELD_ALIASES[field];
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex((h, i) => !claimed.has(i) && h === alias);
      if (idx !== -1) {
        mapping[field] = idx;
        claimed.add(idx);
        return;
      }
    }
    // fall back to "contains" match if no exact alias matched
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex((h, i) => !claimed.has(i) && h.includes(alias));
      if (idx !== -1) {
        mapping[field] = idx;
        claimed.add(idx);
        return;
      }
    }
  });

  return mapping;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
