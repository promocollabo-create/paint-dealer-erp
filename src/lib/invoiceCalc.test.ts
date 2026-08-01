import { describe, expect, it } from "vitest";
import { calculateInvoiceItem, calculateInvoiceTotals, calculateMRP } from "./invoiceCalc";

describe("calculateInvoiceItem — Allied Paint Industries method", () => {
  it("TEST 1: gross/discount/gst/final match the spec's raw and displayed values", () => {
    const result = calculateInvoiceItem({
      quantity: 8,
      unitPrice: 4616.44,
      discountPercent: 15,
      gstPercent: 18
    });
    expect(result.gross).toBeCloseTo(36931.52, 2);
    expect(result.discountAmount).toBeCloseTo(5539.73, 2); // raw 5539.728
    expect(result.gstAmount).toBeCloseTo(6647.67, 2); // raw 6647.6736
    expect(result.lineTotal).toBeCloseTo(38039.47, 2); // raw 38039.4656
  });

  it("TEST 2: single-unit line with displayed discount/GST/final/MRP", () => {
    const result = calculateInvoiceItem({
      quantity: 1,
      unitPrice: 1401.11,
      discountPercent: 15,
      gstPercent: 18
    });
    expect(result.gross).toBeCloseTo(1401.11, 2);
    expect(result.discountAmount).toBeCloseTo(210.17, 2); // raw 210.1665
    expect(result.gstAmount).toBeCloseTo(252.2, 2); // raw 252.1998
    expect(result.lineTotal).toBeCloseTo(1443.14, 2); // raw 1443.1433

    const mrp = calculateMRP(1401.11, 18);
    expect(mrp).toBeCloseTo(1653.31, 2);
  });

  it("TEST 3: discount = 0% -> final = gross + GST", () => {
    const result = calculateInvoiceItem({
      quantity: 2,
      unitPrice: 500,
      discountPercent: 0,
      gstPercent: 18
    });
    expect(result.lineTotal).toBeCloseTo(result.gross + result.gstAmount, 2);
    expect(result.discountAmount).toBe(0);
  });

  it("TEST 4: GST = 0% -> final = gross - discount", () => {
    const result = calculateInvoiceItem({
      quantity: 2,
      unitPrice: 500,
      discountPercent: 10,
      gstPercent: 0
    });
    expect(result.lineTotal).toBeCloseTo(result.gross - result.discountAmount, 2);
    expect(result.gstAmount).toBe(0);
  });

  it("TEST 5: discount = 0% and GST = 0% -> final = gross", () => {
    const result = calculateInvoiceItem({
      quantity: 3,
      unitPrice: 250,
      discountPercent: 0,
      gstPercent: 0
    });
    expect(result.lineTotal).toBe(result.gross);
  });

  it("GST is calculated from the ORIGINAL gross, never the post-discount value", () => {
    const result = calculateInvoiceItem({
      quantity: 1,
      unitPrice: 1000,
      discountPercent: 50,
      gstPercent: 18
    });
    // Correct: 1000 * 18% = 180. Wrong (pre-fix) behaviour would give 500 * 18% = 90.
    expect(result.gstAmount).toBe(180);
    expect(result.discountAmount).toBe(500);
    expect(result.lineTotal).toBe(680);
  });

  it("clamps invalid/out-of-range inputs instead of producing NaN/Infinity", () => {
    const result = calculateInvoiceItem({
      quantity: NaN as unknown as number,
      unitPrice: -50,
      discountPercent: 150,
      gstPercent: -10
    });
    expect(Number.isFinite(result.gross)).toBe(true);
    expect(Number.isFinite(result.discountAmount)).toBe(true);
    expect(Number.isFinite(result.gstAmount)).toBe(true);
    expect(Number.isFinite(result.lineTotal)).toBe(true);
    expect(result.gross).toBe(0);
  });
});

describe("calculateInvoiceTotals", () => {
  it("TEST 6: multi-product invoice totals equal the sum of individually calculated items", () => {
    const itemInputs = [
      { quantity: 8, unitPrice: 4616.44, discountPercent: 15, gstPercent: 18 },
      { quantity: 1, unitPrice: 1401.11, discountPercent: 15, gstPercent: 18 },
      { quantity: 3, unitPrice: 250, discountPercent: 0, gstPercent: 0 },
      { quantity: 2, unitPrice: 500, discountPercent: 10, gstPercent: 5 }
    ];
    const items = itemInputs.map(calculateInvoiceItem);
    const totals = calculateInvoiceTotals(items);

    const expectedSubtotal = items.reduce((s, i) => s + i.gross, 0);
    const expectedDiscount = items.reduce((s, i) => s + i.discountAmount, 0);
    const expectedGst = items.reduce((s, i) => s + i.gstAmount, 0);
    const expectedGrandTotal = items.reduce((s, i) => s + i.lineTotal, 0);

    expect(totals.subtotal).toBeCloseTo(expectedSubtotal, 2);
    expect(totals.discountTotal).toBeCloseTo(expectedDiscount, 2);
    expect(totals.gstTotal).toBeCloseTo(expectedGst, 2);
    // Grand total is Total Gross - Total Discount + Total GST (component-wise sums per
    // Section 9), so it can differ from the sum of individually-rounded item finals by at
    // most one cent per item — the well-known "penny rounding" effect of rounding each line
    // before summing. Both figures are internally consistent; they just aren't required to
    // be identical to the last cent.
    expect(Math.abs(totals.grandTotal - expectedGrandTotal)).toBeLessThanOrEqual(0.01 * items.length);
    // The formula itself must hold exactly:
    expect(totals.grandTotal).toBeCloseTo(totals.subtotal - totals.discountTotal + totals.gstTotal, 2);
  });

  it("applies withholding tax on top of the gross/discount/GST rollup", () => {
    const items = [calculateInvoiceItem({ quantity: 1, unitPrice: 1000, discountPercent: 0, gstPercent: 18 })];
    const totals = calculateInvoiceTotals(items, { enabled: true, percent: 10 });
    // beforeWht = 1000 - 0 + 180 = 1180; wht = 118; grand = 1062
    expect(totals.whtAmount).toBeCloseTo(118, 2);
    expect(totals.grandTotal).toBeCloseTo(1062, 2);
  });

  it("skips withholding tax when disabled", () => {
    const items = [calculateInvoiceItem({ quantity: 1, unitPrice: 1000, discountPercent: 0, gstPercent: 18 })];
    const totals = calculateInvoiceTotals(items, { enabled: false, percent: 10 });
    expect(totals.whtAmount).toBe(0);
    expect(totals.grandTotal).toBeCloseTo(1180, 2);
  });
});

describe("calculateMRP", () => {
  it("MRP = retail price + GST on retail price, unaffected by discount", () => {
    expect(calculateMRP(1401.11, 18)).toBeCloseTo(1653.31, 2);
    expect(calculateMRP(0, 18)).toBe(0);
    expect(calculateMRP(1000, 0)).toBe(1000);
  });
});
