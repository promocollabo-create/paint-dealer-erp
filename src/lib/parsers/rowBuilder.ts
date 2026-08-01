import { ParsedPriceRow } from "@/types";
import { PriceListField, toNumber } from "./columnMapper";
import { RawSheet } from "./excelParser";

export function buildParsedRows(
  sheet: RawSheet,
  mapping: Partial<Record<PriceListField, number>>
): ParsedPriceRow[] {
  return sheet.rows.map((row) => {
    const get = (field: PriceListField) => {
      const idx = mapping[field];
      return idx === undefined ? "" : row[idx] ?? "";
    };

    const productName = get("productName");
    const retailPrice = toNumber(get("retailPrice"));

    const needsReview = !productName || retailPrice === 0;

    return {
      company: get("company"),
      category: get("category"),
      series: get("series"),
      productName,
      packing: get("packing"),
      retailPrice,
      gst: toNumber(get("gst")),
      needsReview
    };
  });
}
