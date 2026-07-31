import type { RawSheet } from "./excelParser";

const HEADER_KEYWORDS = [
  "company",
  "category",
  "series",
  "product",
  "code",
  "packing",
  "price",
  "rp",
  "gst",
  "mrp"
];

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

function looksLikeHeader(cells: Cell[]): boolean {
  const joined = cells.map((c) => c.text.toLowerCase()).join(" ");
  const matches = HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;
  return matches >= 3;
}

export async function parsePdfFile(file: File): Promise<RawSheet> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  let headerCells: Cell[] | null = null;
  const dataLines: Line[] = [];

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
      const cells = clusterCells(line.items);
      if (cells.length < 3) continue; // too sparse to be a table row

      if (!headerCells && looksLikeHeader(cells)) {
        headerCells = cells;
        continue;
      }
      if (headerCells && looksLikeHeader(cells)) {
        // a repeated header on a later page — skip it
        continue;
      }
      dataLines.push(line);
    }
  }

  if (!headerCells) {
    throw new Error(
      "Couldn't detect a header row in this PDF (expected columns like Company, Product, Code, Price, GST, MRP). Try exporting it as Excel instead, or use the manual product form."
    );
  }

  // Column boundaries = midpoints between consecutive header cell x-starts.
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

  return {
    headers: sortedHeaders.map((h) => h.text),
    rows: rows.filter((r) => r.some((c) => c.length > 0))
  };
}
