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
    const productCode = get("productCode");
    const retailPrice = toNumber(get("retailPrice"));
    const mrp = toNumber(get("mrp"));

    const needsReview = !productName || !productCode || (retailPrice === 0 && mrp === 0);

    return {
      company: get("company"),
      category: get("category"),
      series: get("series"),
      productName,
      productCode,
      packing: get("packing"),
      retailPrice,
      gst: toNumber(get("gst")),
      mrp,
      needsReview
    };
  });
}
