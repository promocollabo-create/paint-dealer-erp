import { ParsedPriceRow } from "@/types";
import { RawSheet } from "./excelParser";
import { autoMapColumns } from "./columnMapper";
import { buildParsedRows } from "./rowBuilder";

/**
 * Paint dealer price-list PDFs come in two shapes:
 *
 *  1. FLAT TABLE — one header row (Company, Category, Series, Product, Packaging,
 *     Retail Price, GST) followed by one data row per packaging variant.
 *
 *  2. HIERARCHICAL DOCUMENT — Company / Category / Series / Product Name appear as
 *     section headings (either explicitly labelled, e.g. "Series: Weathershield", or
 *     as plain heading lines), followed by a small "Packaging | Retail Price | GST"
 *     block listing each size for that product, e.g.:
 *
 *       Allied Paint Industries
 *       Decorative
 *       Weathershield
 *       Weathershield Emulsion
 *       Qtr   1,401.11   18%
 *       Gln   4,616.44   18%
 *       Drm   17,645.00  18%
 *
 * We try the flat-table detector first (it's unambiguous when it matches). If no
 * table header is found, we fall back to the hierarchical heading/price-row parser
 * below, which never invents a Product Code or MRP, never mistakes a Packaging value
 * for a Product Name, and never copies the same text into Company/Category/Series.
 */

interface PositionedItem {
  text: string;
  x: number;
  y: number;
}

interface Line {
  y: number;
  items: PositionedItem[];
}

function groupIntoLines(items: PositionedItem[], yTolerance = 3): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: Line[] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.y) <= yTolerance);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  return lines;
}

interface Cell {
  text: string;
  xStart: number;
  xEnd: number;
}

function clusterCells(items: PositionedItem[], xGapThreshold = 9): Cell[] {
  const cells: Cell[] = [];
  for (const item of items) {
    const last = cells[cells.length - 1];
    if (last && item.x - last.xEnd <= xGapThreshold) {
      last.text = `${last.text} ${item.text}`.trim();
      last.xEnd = item.x + item.text.length * 4; // rough width estimate
    } else {
      cells.push({ text: item.text, xStart: item.x, xEnd: item.x + item.text.length * 4 });
    }
  }
  return cells.filter((c) => c.text.trim().length > 0);
}

/* --------------------------- shared: read the raw text lines --------------------------- */

async function extractLines(file: File): Promise<{ lines: Line[]; minX: number }> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allLines: Line[] = [];
  let minX = Infinity;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: PositionedItem[] = content.items
      .map((it: any) => ({
        text: String(it.str ?? "").trim(),
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0
      }))
      .filter((it) => it.text.length > 0);

    const lines = groupIntoLines(items);
    for (const line of lines) {
      const x = Math.min(...line.items.map((i) => i.x));
      if (x < minX) minX = x;
    }
    allLines.push(...lines);
  }

  return { lines: allLines, minX: Number.isFinite(minX) ? minX : 0 };
}

/* --------------------------------- strategy 1: flat table --------------------------------- */

const HEADER_KEYWORDS = ["company", "category", "series", "product", "packing", "packaging", "price", "rp", "gst"];

function looksLikeHeader(cells: Cell[]): boolean {
  const joined = cells.map((c) => c.text.toLowerCase()).join(" ");
  const matches = HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;
  return matches >= 3;
}

function tryParseAsFlatTable(lines: Line[]): ParsedPriceRow[] | null {
  let headerCells: Cell[] | null = null;
  const dataLines: Line[] = [];

  for (const line of lines) {
    const cells = clusterCells(line.items);
    if (cells.length < 3) continue;

    if (!headerCells && looksLikeHeader(cells)) {
      headerCells = cells;
      continue;
    }
    if (headerCells && looksLikeHeader(cells)) continue; // repeated header on a later page
    if (headerCells) dataLines.push(line);
  }

  if (!headerCells || dataLines.length === 0) return null;

  const sortedHeaders = [...headerCells].sort((a, b) => a.xStart - b.xStart);
  const boundaries = sortedHeaders.map((h, i) => {
    const nextStart = sortedHeaders[i + 1]?.xStart ?? Infinity;
    return { start: i === 0 ? -Infinity : (sortedHeaders[i - 1].xStart + h.xStart) / 2, end: (h.xStart + nextStart) / 2 };
  });

  const rows: string[][] = dataLines.map((line) => {
    const row = new Array(sortedHeaders.length).fill("");
    for (const item of line.items) {
      const colIndex = boundaries.findIndex((b) => item.x >= b.start && item.x < b.end);
      const target = colIndex === -1 ? boundaries.length - 1 : colIndex;
      row[target] = (row[target] ? `${row[target]} ` : "") + item.text;
    }
    return row.map((c) => c.trim());
  });

  const sheet: RawSheet = {
    headers: sortedHeaders.map((h) => h.text),
    rows: rows.filter((r) => r.some((c) => c.length > 0))
  };
  if (!sheet.rows.length) return null;

  const mapping = autoMapColumns(sheet.headers);
  if (mapping.productName === undefined || mapping.retailPrice === undefined) return null; // not a usable table

  return buildParsedRows(sheet, mapping);
}

/* ---------------------- strategy 2: hierarchical heading/price-row document ---------------------- */

const LABEL_RE = /^\s*(company|category|series|product\s*name|product)\s*[:\-]\s*(.+?)\s*$/i;

const CATEGORY_HINTS = [
  "decorative",
  "industrial",
  "automotive",
  "wood care",
  "wood finish",
  "distemper",
  "emulsion",
  "enamel",
  "primer",
  "putty",
  "texture",
  "thinner",
  "waterproofing",
  "adhesive",
  "marine",
  "road marking",
  "powder coat",
  "metal finish"
];

const COMPANY_HINTS = /paint|industries|colou?rs?|chemicals?|enterprises?|coatings?|\bltd\b|\bpvt\b|\bcompany\b/i;

/** A price row is "<packaging label> <retail price> <gst>%" — the packaging label is short
 *  free text (never a full sentence), the price is numeric, GST is a small percentage. */
const PRICE_ROW_RE = /^(.{1,24}?)[\s|]+([\d,]+(?:\.\d{1,2})?)[\s|]+(\d{1,3}(?:\.\d+)?)\s*%?\s*$/;
/** Fallback when a row only carries packaging + price (GST inherited from the same product block). */
const PRICE_ROW_NO_GST_RE = /^(.{1,24}?)[\s|]+([\d,]+(?:\.\d{1,2})?)\s*$/;

const TABLE_HEADER_RE = /packaging|packing/i;

function isTableHeaderLine(text: string): boolean {
  const lower = text.toLowerCase();
  return TABLE_HEADER_RE.test(lower) && /price/.test(lower) && /gst/.test(lower);
}

function parseHierarchical(lines: Line[]): ParsedPriceRow[] {
  const rows: ParsedPriceRow[] = [];

  let currentCompany = "";
  let currentCategory = "";
  let currentSeries = "";
  let currentProductName = "";
  let stickyGst = 0;
  let pendingHeadings: string[] = [];
  let explicitProductName: string | null = null;

  function flushProductNameFromPending() {
    if (explicitProductName) {
      currentProductName = explicitProductName;
      return;
    }
    if (pendingHeadings.length === 0) return; // keep sticky currentProductName (more rows of the same product)
    currentProductName = pendingHeadings[pendingHeadings.length - 1];
    if (pendingHeadings.length >= 2) {
      currentSeries = pendingHeadings[pendingHeadings.length - 2];
    }
    pendingHeadings = [];
  }

  for (const line of lines) {
    const cells = clusterCells(line.items);
    if (cells.length === 0) continue;
    const text = cells.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (isTableHeaderLine(text)) continue; // formatting artifact, not data

    const labelMatch = text.match(LABEL_RE);
    if (labelMatch) {
      const field = labelMatch[1].toLowerCase().replace(/\s+/g, "");
      const value = labelMatch[2].trim();
      if (field === "company") {
        currentCompany = value;
        explicitProductName = null;
      } else if (field === "category") {
        currentCategory = value;
      } else if (field === "series") {
        currentSeries = value;
      } else {
        explicitProductName = value;
      }
      continue;
    }

    // Try price row (packaging + retail price + gst%)
    const priceMatch = text.match(PRICE_ROW_RE);
    if (priceMatch) {
      const packing = priceMatch[1].trim();
      const retailPrice = parseFloat(priceMatch[2].replace(/,/g, ""));
      const gst = parseFloat(priceMatch[3]);
      if (Number.isFinite(retailPrice) && retailPrice > 0 && !/^\d+$/.test(packing)) {
        flushProductNameFromPending();
        stickyGst = Number.isFinite(gst) ? gst : stickyGst;
        rows.push({
          company: currentCompany,
          category: currentCategory,
          series: currentSeries,
          productName: currentProductName,
          packing,
          retailPrice,
          gst: stickyGst,
          needsReview: !currentProductName || !currentCompany
        });
        continue;
      }
    }

    // Fallback: packaging + price only, GST inherited from the current product block
    const priceOnlyMatch = text.match(PRICE_ROW_NO_GST_RE);
    if (priceOnlyMatch && pendingHeadings.length === 0 && currentProductName) {
      const packing = priceOnlyMatch[1].trim();
      const retailPrice = parseFloat(priceOnlyMatch[2].replace(/,/g, ""));
      if (Number.isFinite(retailPrice) && retailPrice > 0 && !/^\d+$/.test(packing) && packing.split(" ").length <= 3) {
        flushProductNameFromPending();
        rows.push({
          company: currentCompany,
          category: currentCategory,
          series: currentSeries,
          productName: currentProductName,
          packing,
          retailPrice,
          gst: stickyGst,
          needsReview: !currentProductName || !currentCompany
        });
        continue;
      }
    }

    // Otherwise it's a heading line — classify it as Company / Category, or buffer it as a
    // Series/Product Name candidate (the last buffered heading before a price row becomes the
    // Product Name, the one before that becomes the Series — never the same text twice).
    if (COMPANY_HINTS.test(text) && text !== currentCompany) {
      currentCompany = text;
      explicitProductName = null;
      continue;
    }
    const categoryHint = CATEGORY_HINTS.find((h) => text.toLowerCase() === h || text.toLowerCase().includes(h));
    if (categoryHint && text.length <= 30) {
      currentCategory = text;
      continue;
    }

    explicitProductName = null;
    pendingHeadings.push(text);
    // A heading run shouldn't grow unbounded — keep only the two most recent candidates
    // (Series, Product Name); anything older is stale context from a previous section.
    if (pendingHeadings.length > 2) pendingHeadings = pendingHeadings.slice(-2);
  }

  return rows;
}

/* --------------------------------------- entry point --------------------------------------- */

export async function parsePdfPriceList(file: File): Promise<ParsedPriceRow[]> {
  const { lines } = await extractLines(file);
  if (lines.length === 0) {
    throw new Error("Couldn't read any text from this PDF. Try exporting it as Excel instead, or use the manual product form.");
  }

  const flatTableRows = tryParseAsFlatTable(lines);
  const rows = flatTableRows && flatTableRows.length > 0 ? flatTableRows : parseHierarchical(lines);

  if (!rows.length) {
    throw new Error(
      "Couldn't detect any products in this PDF (expected a table with Company/Category/Series/Product/Packaging/Retail Price/GST, or a document with those as section headings above a Packaging/Retail Price/GST list). Try exporting it as Excel instead, or use the manual product form."
    );
  }

  return rows;
}
