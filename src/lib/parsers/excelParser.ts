import * as XLSX from "xlsx";

export interface RawSheet {
  headers: string[];
  rows: string[][];
}

/** Reads the first worksheet of an Excel/CSV file into a header row + string rows.
 *  Kept deliberately dumb (no field mapping here) — column mapping happens in columnMapper.ts
 *  so the same review UI works for both Excel and PDF sources. */
export async function parseExcelFile(file: File): Promise<RawSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The uploaded file has no sheets.");

  const sheet = workbook.Sheets[sheetName];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });

  if (grid.length < 2) {
    throw new Error("Couldn't find a header row and at least one data row.");
  }

  const headers = grid[0].map((h) => String(h ?? "").trim());
  const rows = grid.slice(1).map((row) => headers.map((_, i) => String(row[i] ?? "").trim()));

  return { headers, rows };
}
