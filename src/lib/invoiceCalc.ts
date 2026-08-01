/**
 * Allied Paint Industries invoice calculation engine.
 *
 * SINGLE SOURCE OF TRUTH for all invoice math (item lines, invoice totals, MRP).
 * Invoice creation, invoice preview, saved invoices, print/PDF, and dashboard totals
 * must all read amounts that were produced here — never re-derive the formulas elsewhere.
 *
 * Business rule (do not deviate):
 *   GROSS                = UNIT PRICE x QUANTITY
 *   DISCOUNT              = GROSS x DISCOUNT %      (always from the ORIGINAL gross)
 *   GST                   = GROSS x GST %            (always from the ORIGINAL gross, never
 *                                                      from the discounted/taxable value)
 *   VALUE AFTER DISCOUNT  = GROSS - DISCOUNT
 *   FINAL TOTAL           = GROSS - DISCOUNT + GST
 *   MRP                   = RETAIL PRICE + GST ON RETAIL PRICE (discount never affects MRP)
 *
 * All intermediate math is done with decimal.js so we never lose precision to binary
 * floating point. Only the values returned to callers (which are what get displayed and
 * persisted) are rounded, and each is rounded independently from the same raw inputs —
 * never by rounding an earlier result and then feeding the rounded value into the next step.
 */
import Decimal from "decimal.js";

/** Standard 2-decimal monetary rounding used everywhere in the app. */
export function roundMoney(value: number): number {
  const d = toSafeDecimal(value);
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Clamp a percentage input into the valid 0–100 range, treating invalid input as 0. */
export function clampPercent(value: number | undefined | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Clamp a quantity/price input to be >= 0, treating invalid input as 0. */
export function clampNonNegative(value: number | undefined | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function toSafeDecimal(value: number | undefined | null): Decimal {
  const n = Number(value);
  if (!Number.isFinite(n)) return new Decimal(0);
  return new Decimal(n);
}

export interface InvoiceItemCalcInput {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstPercent: number;
}

export interface InvoiceItemCalcResult {
  /** Gross Amount = Unit Price x Quantity */
  gross: number;
  /** Discount Amount = Gross Amount x Discount % (from ORIGINAL gross) */
  discountAmount: number;
  /** Gross Amount - Discount Amount */
  valueAfterDiscount: number;
  /** GST Amount = Gross Amount x GST % (from ORIGINAL gross, never the discounted value) */
  gstAmount: number;
  /** Gross Amount - Discount Amount + GST Amount */
  lineTotal: number;
}

/**
 * Calculates a single invoice line item using the Allied Paint Industries method.
 * Discount and GST are BOTH computed independently from the original gross amount —
 * GST is never computed on the post-discount (taxable) value.
 */
export function calculateInvoiceItem(input: InvoiceItemCalcInput): InvoiceItemCalcResult {
  const quantity = toSafeDecimal(clampNonNegative(input.quantity));
  const unitPrice = toSafeDecimal(clampNonNegative(input.unitPrice));
  const discountPercent = toSafeDecimal(clampPercent(input.discountPercent));
  const gstPercent = toSafeDecimal(clampPercent(input.gstPercent));

  const gross = quantity.times(unitPrice);
  const discountAmount = gross.times(discountPercent).dividedBy(100);
  const valueAfterDiscount = gross.minus(discountAmount);
  const gstAmount = gross.times(gstPercent).dividedBy(100);
  const lineTotal = gross.minus(discountAmount).plus(gstAmount);

  return {
    gross: roundMoney(gross.toNumber()),
    discountAmount: roundMoney(discountAmount.toNumber()),
    valueAfterDiscount: roundMoney(valueAfterDiscount.toNumber()),
    gstAmount: roundMoney(gstAmount.toNumber()),
    lineTotal: roundMoney(lineTotal.toNumber())
  };
}

/** Retail price including GST. Discount never affects MRP. */
export function calculateMRP(retailPrice: number, gstPercent: number): number {
  const price = toSafeDecimal(clampNonNegative(retailPrice));
  const gst = toSafeDecimal(clampPercent(gstPercent));
  const gstOnRetail = price.times(gst).dividedBy(100);
  return roundMoney(price.plus(gstOnRetail).toNumber());
}

export interface InvoiceTotalsLineInput {
  gross: number;
  discountAmount: number;
  gstAmount: number;
}

export interface InvoiceWithholdingInput {
  enabled: boolean;
  percent: number;
}

export interface InvoiceTotalsCalcResult {
  subtotal: number;
  discountTotal: number;
  valueAfterDiscount: number;
  gstTotal: number;
  whtAmount: number;
  grandTotal: number;
}

/**
 * Rolls up already-calculated line items into invoice-level totals. Each component
 * (subtotal, discount, GST) is summed independently across items — if lines have
 * different discount/GST percentages, no single blended percentage is invented.
 * Grand Total = Total Gross - Total Discount + Total GST, computed from those summed
 * components (per spec section 9). This will typically equal the sum of the individual
 * item final totals, but can differ by up to a cent per item in edge cases — the standard
 * "penny rounding" effect of rounding each line to 2 decimals before summing.
 */
export function calculateInvoiceTotals(
  items: InvoiceTotalsLineInput[],
  wht?: InvoiceWithholdingInput
): InvoiceTotalsCalcResult {
  let subtotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let gstTotal = new Decimal(0);

  for (const item of items) {
    subtotal = subtotal.plus(toSafeDecimal(item.gross));
    discountTotal = discountTotal.plus(toSafeDecimal(item.discountAmount));
    gstTotal = gstTotal.plus(toSafeDecimal(item.gstAmount));
  }

  const valueAfterDiscount = subtotal.minus(discountTotal);
  const beforeWht = subtotal.minus(discountTotal).plus(gstTotal);

  const whtPercent = wht?.enabled ? toSafeDecimal(clampPercent(wht.percent)) : new Decimal(0);
  const whtAmount = beforeWht.times(whtPercent).dividedBy(100);
  const grandTotal = beforeWht.minus(whtAmount);

  return {
    subtotal: roundMoney(subtotal.toNumber()),
    discountTotal: roundMoney(discountTotal.toNumber()),
    valueAfterDiscount: roundMoney(valueAfterDiscount.toNumber()),
    gstTotal: roundMoney(gstTotal.toNumber()),
    whtAmount: roundMoney(whtAmount.toNumber()),
    grandTotal: roundMoney(grandTotal.toNumber())
  };
}
