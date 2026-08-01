"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { AlertTriangle, Loader2, Upload, FileSpreadsheet, FileText, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import Topbar from "@/components/layout/Topbar";
import { useAuth } from "@/context/AuthContext";
import { parseExcelFile, RawSheet } from "@/lib/parsers/excelParser";
import { parsePdfFile } from "@/lib/parsers/pdfParser";
import { autoMapColumns, FIELD_LABELS, PriceListField } from "@/lib/parsers/columnMapper";
import { buildParsedRows } from "@/lib/parsers/rowBuilder";
import { generateSearchTokens } from "@/lib/search";
import { ParsedPriceRow, PriceListVersion } from "@/types";
import toast from "react-hot-toast";

const REQUIRED_FIELDS: PriceListField[] = ["productName", "productCode"];
const ALL_FIELDS: PriceListField[] = [
  "company",
  "category",
  "series",
  "productName",
  "productCode",
  "packing",
  "retailPrice",
  "gst",
  "mrp"
];

function money(n: number) {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

function VersionHistory({ refreshKey }: { refreshKey: number }) {
  const [versions, setVersions] = useState<PriceListVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "priceListVersions"), orderBy("versionNumber", "desc"), fsLimit(20)));
        if (cancelled) return;
        setVersions(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              versionNumber: data.versionNumber ?? 0,
              fileName: data.fileName ?? "",
              fileType: data.fileType ?? "excel",
              effectiveDate: data.effectiveDate?.toMillis?.() ?? Date.now(),
              uploadedBy: data.uploadedBy ?? "",
              uploadedAt: data.uploadedAt?.toMillis?.() ?? Date.now(),
              itemCount: data.itemCount ?? 0,
              notes: data.notes ?? ""
            };
          })
        );
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="card">
      <h2 className="mb-1 font-display text-base font-semibold">Price List Version History</h2>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
        Each upload is saved as a permanent, uneditable version. Invoices always reference the
        version that was active when they were created, so past invoices never change if prices
        update later.
      </p>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No price lists uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-3 text-sm">
              <div className="flex items-center gap-3">
                {v.fileType === "pdf" ? (
                  <FileText className="h-4 w-4 text-swatch-clay" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-swatch-moss" />
                )}
                <div>
                  <p className="font-medium">Version {v.versionNumber} — {v.fileName}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Effective {new Date(v.effectiveDate).toLocaleDateString()} · {v.itemCount} items
                  </p>
                </div>
              </div>
              <span className="text-xs text-ink-400">{new Date(v.uploadedAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadFlow({ onCommitted }: { onCommitted: () => void }) {
  const { appUser } = useAuth();
  const [sheet, setSheet] = useState<RawSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"pdf" | "excel">("excel");
  const [mapping, setMapping] = useState<Partial<Record<PriceListField, number>>>({});
  const [rows, setRows] = useState<ParsedPriceRow[] | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number; failed: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".pdf"];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const ext = ACCEPTED_EXTENSIONS.find((x) => lowerName.endsWith(x));
    if (!ext) {
      toast.error("Unsupported file type. Please upload a .xlsx, .xls, .csv, or .pdf file.");
      e.target.value = "";
      return;
    }
    if (file.size === 0) {
      toast.error("That file is empty.");
      e.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large (max 15MB).");
      e.target.value = "";
      return;
    }

    setRows(null);
    setSheet(null);
    setSummary(null);
    setParsing(true);
    setFileName(file.name);
    const isPdf = ext === ".pdf";
    setFileType(isPdf ? "pdf" : "excel");

    try {
      const parsed = isPdf ? await parsePdfFile(file) : await parseExcelFile(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        toast.error("No readable rows were found in that file. Check the format and try again.");
        setParsing(false);
        return;
      }
      setSheet(parsed);
      setMapping(autoMapColumns(parsed.headers));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Couldn't read that file. Please check the format and try again.");
    } finally {
      setParsing(false);
    }
  }

  function buildPreview() {
    if (!sheet) return;
    const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);
    if (missing.length > 0) {
      toast.error(`Please map: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}`);
      return;
    }
    setRows(buildParsedRows(sheet, mapping));
  }

  function updateRow(index: number, field: keyof ParsedPriceRow, value: string) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const row = { ...next[index] };
      if (field === "retailPrice" || field === "gst" || field === "mrp") {
        (row as any)[field] = Number(value) || 0;
      } else if (field !== "needsReview") {
        (row as any)[field] = value;
      }
      row.needsReview = !row.productName || !row.productCode;
      next[index] = row;
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCommit() {
    if (!rows || rows.length === 0) return;
    const blocking = rows.filter((r) => !r.productName || !r.productCode);
    if (blocking.length > 0) {
      toast.error(`${blocking.length} row(s) are missing a product name or code. Fix or remove them first.`);
      return;
    }

    // Rows that are blank/duplicated within the same file are skipped up front rather than
    // written twice — importing a file with the same product code twice used to create two
    // separate product documents for it.
    const seenCodes = new Set<string>();
    const dedupedRows: ParsedPriceRow[] = [];
    let skippedDuplicatesInFile = 0;
    for (const row of rows) {
      const code = row.productCode.trim().toLowerCase();
      if (seenCodes.has(code)) {
        skippedDuplicatesInFile++;
        continue;
      }
      seenCodes.add(code);
      dedupedRows.push(row);
    }

    setCommitting(true);
    setSummary(null);
    setProgress({ done: 0, total: dedupedRows.length });

    let created = 0;
    let updated = 0;
    let failed = 0;
    const versionRef = doc(collection(db, "priceListVersions"));

    try {
      const versionCountSnap = await getCountFromServer(collection(db, "priceListVersions"));
      const versionNumber = versionCountSnap.data().count + 1;

      await writeBatch(db)
        .set(versionRef, {
          versionNumber,
          fileName,
          fileType,
          effectiveDate: new Date(effectiveDate),
          uploadedBy: appUser?.name ?? appUser?.email ?? "unknown",
          uploadedAt: serverTimestamp(),
          itemCount: dedupedRows.length,
          notes: ""
        })
        .commit();

      // 1) Write the immutable snapshot rows in batches of 400 (Firestore batch limit is 500 writes).
      for (let i = 0; i < dedupedRows.length; i += 400) {
        const chunk = dedupedRows.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const row of chunk) {
          const itemRef = doc(collection(db, "priceListVersions", versionRef.id, "items"));
          batch.set(itemRef, row);
        }
        await batch.commit();
      }

      // 2) Upsert the live product catalog by productCode. Each row is handled independently
      //    so one bad row can't fail the entire import — it's just counted under "failed".
      let done = 0;
      for (let i = 0; i < dedupedRows.length; i += 25) {
        const chunk = dedupedRows.slice(i, i + 25);
        const batch = writeBatch(db);
        const chunkResults: ("created" | "updated" | "failed")[] = [];

        for (const row of chunk) {
          try {
            const existing = await getDocs(
              query(collection(db, "products"), where("productCode", "==", row.productCode), fsLimit(1))
            );
            const searchTokens = generateSearchTokens({
              productName: row.productName,
              productCode: row.productCode,
              category: row.category,
              series: row.series,
              company: row.company
            });
            const priceFields = {
              company: row.company,
              category: row.category || "Other Accessories",
              series: row.series,
              productName: row.productName,
              productCode: row.productCode,
              packing: row.packing,
              retailPrice: row.retailPrice,
              gst: row.gst,
              mrp: row.mrp,
              currentPriceListVersionId: versionRef.id,
              searchTokens,
              updatedAt: serverTimestamp()
            };
            if (!existing.empty) {
              batch.update(existing.docs[0].ref, priceFields);
              chunkResults.push("updated");
            } else {
              const newRef = doc(collection(db, "products"));
              batch.set(newRef, {
                ...priceFields,
                colorName: "",
                shadeCode: "",
                unit: "",
                status: "active",
                source: "priceList",
                createdAt: serverTimestamp()
              });
              chunkResults.push("created");
            }
          } catch (rowErr) {
            console.error("Row failed:", row.productCode, rowErr);
            chunkResults.push("failed");
          }
        }

        try {
          await batch.commit();
          chunkResults.forEach((r) => {
            if (r === "created") created++;
            else if (r === "updated") updated++;
            else failed++;
          });
        } catch (batchErr) {
          console.error("Batch commit failed:", batchErr);
          failed += chunkResults.length;
        }

        done += chunk.length;
        setProgress({ done, total: dedupedRows.length });
      }

      setSummary({ created, updated, skipped: skippedDuplicatesInFile, failed });

      if (failed > 0) {
        toast.error(`Imported with ${failed} failure(s). See summary below.`);
      } else {
        toast.success(
          `Price list version ${versionNumber} committed — ${created} added, ${updated} updated${
            skippedDuplicatesInFile ? `, ${skippedDuplicatesInFile} duplicate rows skipped` : ""
          }.`
        );
      }
      setSheet(null);
      setRows(null);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onCommitted();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while committing the price list. No products were changed for unprocessed rows.");
    } finally {
      setCommitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-1 font-display text-base font-semibold">Upload Price List</h2>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
        Supports Excel (.xlsx, .xls, .csv) and PDF. We'll auto-detect Company, Category, Series,
        Product, Product Code, Packing, Retail Price, GST, and MRP — you can correct anything
        before it's saved.
      </p>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-ink-100 bg-ink-50 p-4 text-sm sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-800">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Added</p>
            <p className="font-display text-lg font-semibold text-swatch-moss">{summary.created}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Updated</p>
            <p className="font-display text-lg font-semibold text-swatch-teal">{summary.updated}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Skipped (dupes)</p>
            <p className="font-display text-lg font-semibold text-swatch-ochre">{summary.skipped}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Failed</p>
            <p className="font-display text-lg font-semibold text-swatch-clay">{summary.failed}</p>
          </div>
        </div>
      )}

      {!sheet && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-ink-200 py-10 text-center hover:border-brand-400 dark:border-ink-700">
          {parsing ? <Loader2 className="h-6 w-6 animate-spin text-brand-500" /> : <Upload className="h-6 w-6 text-ink-400" />}
          <span className="text-sm font-medium">{parsing ? "Reading file…" : "Click to upload a price list"}</span>
          <span className="text-xs text-ink-400">.xlsx, .xls, .csv, or .pdf</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
            onChange={handleFile}
            disabled={parsing}
          />
        </label>
      )}

      {sheet && !rows && (
        <div className="space-y-4">
          <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm dark:bg-ink-800">
            <span className="font-medium">{fileName}</span> — {sheet.rows.length} rows detected. Confirm the
            column mapping below.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_FIELDS.map((field) => (
              <div key={field}>
                <label className="label">
                  {FIELD_LABELS[field]}
                  {REQUIRED_FIELDS.includes(field) && <span className="text-swatch-clay"> *</span>}
                </label>
                <select
                  className="input"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value === "" ? undefined : Number(e.target.value) }))
                  }
                >
                  <option value="">— not in file —</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              className="btn-secondary"
              onClick={() => {
                setSheet(null);
                setFileName("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={buildPreview}>
              Build Preview
            </button>
          </div>
        </div>
      )}

      {rows && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{rows.length} rows</span>
              {rows.some((r) => r.needsReview) && (
                <span className="badge bg-swatch-clay/10 text-swatch-clay">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  {rows.filter((r) => r.needsReview).length} need review
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-ink-500 dark:text-ink-400">Effective date</label>
              <input
                type="date"
                className="input w-auto"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-lg border border-ink-100 dark:border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-ink-100 bg-ink-50 uppercase tracking-wide text-ink-400 dark:border-ink-800 dark:bg-ink-800">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Series</th>
                  <th className="px-3 py-2">Packing</th>
                  <th className="px-3 py-2 text-right">RP</th>
                  <th className="px-3 py-2 text-right">GST</th>
                  <th className="px-3 py-2 text-right">MRP</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {rows.map((row, i) => (
                  <tr key={i} className={row.needsReview ? "bg-swatch-clay/5" : ""}>
                    <td className="px-2 py-1.5">
                      <input className="input px-2 py-1 text-xs" value={row.productName} onChange={(e) => updateRow(i, "productName", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="input px-2 py-1 text-xs" value={row.productCode} onChange={(e) => updateRow(i, "productCode", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="input px-2 py-1 text-xs" value={row.company} onChange={(e) => updateRow(i, "company", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="input px-2 py-1 text-xs" value={row.category} onChange={(e) => updateRow(i, "category", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="input px-2 py-1 text-xs" value={row.series} onChange={(e) => updateRow(i, "series", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="input px-2 py-1 text-xs" value={row.packing} onChange={(e) => updateRow(i, "packing", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" className="input w-20 px-2 py-1 text-right text-xs" value={row.retailPrice} onChange={(e) => updateRow(i, "retailPrice", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" className="input w-16 px-2 py-1 text-right text-xs" value={row.gst} onChange={(e) => updateRow(i, "gst", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" className="input w-20 px-2 py-1 text-right text-xs" value={row.mrp} onChange={(e) => updateRow(i, "mrp", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => removeRow(i)} className="text-swatch-clay hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {progress && (
            <div className="text-sm text-ink-500 dark:text-ink-400">
              Committing… {progress.done} / {progress.total}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              className="btn-secondary"
              disabled={committing}
              onClick={() => {
                setRows(null);
              }}
            >
              Back to Mapping
            </button>
            <button className="btn-primary" disabled={committing || rows.length === 0} onClick={handleCommit}>
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Commit as New Version
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PriceListPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <Topbar title="Price Lists" />
      <main className="flex-1 space-y-5 p-5">
        <UploadFlow onCommitted={() => setRefreshKey((k) => k + 1)} />
        <VersionHistory refreshKey={refreshKey} />
      </main>
    </>
  );
}
