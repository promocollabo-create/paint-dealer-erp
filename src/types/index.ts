export type UserRole = "admin" | "manager" | "staff";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: number;
}

export interface ShopSettings {
  shopName: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  ntnStrn: string;
  invoicePrefix: string;
  currency: string;
  updatedAt: number;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  creditLimit: number;
  outstanding: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  status: "paid" | "partial" | "unpaid";
  createdAt: number;
}

export interface PaymentSummary {
  id: string;
  customerName: string;
  amount: number;
  method: string;
  createdAt: number;
}

/* ------------------------------ Phase 3: Invoices, Payments, Ledger ------------------------------ */

export const PAYMENT_METHODS = ["cash", "bank", "jazzcash", "easypaisa", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  cheque: "Cheque"
};

export interface InvoiceLineItem {
  productId: string;
  productName: string;
  productCode: string;
  series: string;
  packing: string;
  colorName: string;
  shadeCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  lineTotal: number;
}

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "cancelled";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  whtPercent: number;
  whtAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  previousBalance: number;
  remainingBalance: number;
  method: PaymentMethod;
  referenceNumber: string;
  notes: string;
  createdBy: string;
  createdAt: number;
}

export type LedgerEntryType = "invoice" | "payment" | "adjustment";

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: LedgerEntryType;
  refId: string;
  refNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  createdAt: number;
}

/** Permission matrix — the single source of truth for role-gated UI and routes. */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "dashboard.view",
    "dashboard.viewProfit",
    "invoices.create",
    "payments.receive",
    "customers.manage",
    "reports.view",
    "settings.manage",
    "users.manage",
    "products.manage",
    "products.search"
  ],
  manager: [
    "dashboard.view",
    "invoices.create",
    "payments.receive",
    "customers.manage",
    "reports.view",
    "products.manage",
    "products.search"
  ],
  staff: ["dashboard.view", "invoices.create", "payments.receive", "products.search"]
};

export function hasPermission(role: UserRole | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/* ------------------------------ Phase 2: Products & Pricing ------------------------------ */

export const PRODUCT_CATEGORIES = [
  "Paint",
  "Primer",
  "Putty",
  "Enamel",
  "Texture",
  "Thinner",
  "Wood Polish",
  "Waterproofing",
  "Adhesive",
  "Brush",
  "Roller",
  "Paint Tray",
  "Sand Paper",
  "Masking Tape",
  "Wall Filler",
  "Scraper",
  "Safety Items",
  "Other Accessories"
] as const;

export const PRODUCT_UNITS = ["Ltr", "Kg", "Pcs", "Box", "Roll", "Gallon", "Set"] as const;

export type ProductStatus = "active" | "inactive";
export type ProductSource = "priceList" | "manual";

export interface Product {
  id: string;
  company: string;
  category: string;
  series: string;
  productName: string;
  productCode: string;
  packing: string;
  colorName: string;
  shadeCode: string;
  retailPrice: number;
  gst: number;
  mrp: number;
  unit: string;
  status: ProductStatus;
  source: ProductSource;
  currentPriceListVersionId: string | null;
  searchTokens: string[];
  createdAt: number;
  updatedAt: number;
}

/** A raw row as parsed from an uploaded PDF/Excel price list, before an admin reviews it. */
export interface ParsedPriceRow {
  company: string;
  category: string;
  series: string;
  productName: string;
  productCode: string;
  packing: string;
  retailPrice: number;
  gst: number;
  mrp: number;
  /** true when required fields are missing/unparseable and need manual correction before commit */
  needsReview: boolean;
}

export interface PriceListVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileType: "pdf" | "excel";
  effectiveDate: number;
  uploadedBy: string;
  uploadedAt: number;
  itemCount: number;
  notes: string;
}

/** Immutable snapshot row stored under priceListVersions/{id}/items — never edited after commit,
 *  so an old invoice referencing a versionId + productCode always resolves to the original price. */
export interface PriceListItem extends ParsedPriceRow {
  id: string;
}
