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
  company: string;
  category: string;
  series: string;
  packing: string;
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

export type ProductStatus = "active" | "inactive";
export type ProductSource = "priceList" | "manual";

/** One packaging/size variant of a product, each with its own price and GST rate.
 *  e.g. { packing: "Qtr", retailPrice: 1401.11, gst: 18 } */
export interface PackagingOption {
  id: string;
  packing: string;
  retailPrice: number;
  gst: number;
}

/** Product structure: Company -> Category -> Series -> Product Name -> Packaging.
 *  One Product Name can have several packaging variants, each carrying its own
 *  Retail Price (before GST) and GST %. There is no Product Code and no MRP —
 *  the invoice-facing price is always the packaging's Retail Price plus GST
 *  computed on that gross amount. */
export interface Product {
  id: string;
  company: string;
  category: string;
  series: string;
  productName: string;
  packagingOptions: PackagingOption[];
  status: ProductStatus;
  source: ProductSource;
  currentPriceListVersionId: string | null;
  searchTokens: string[];
  createdAt: number;
  updatedAt: number;
}

/** A raw row as parsed from an uploaded PDF/Excel price list, before an admin reviews it.
 *  One row = one packaging variant; rows sharing Company+Category+Series+Product Name are
 *  grouped into a single Product with multiple packaging options when committed. */
export interface ParsedPriceRow {
  company: string;
  category: string;
  series: string;
  productName: string;
  packing: string;
  retailPrice: number;
  gst: number;
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
 *  so an old invoice referencing a versionId + product/packaging always resolves to the original price. */
export interface PriceListItem extends ParsedPriceRow {
  id: string;
}

/* ------------------------------ Phase 4: Product Types & Paint Accessories ------------------------------ */

/** Top-level split of the catalog. Paint keeps the existing Brand → Series → Product →
 *  Packing structure (the `Product` type above). Accessories use a simpler, user-defined
 *  Section → Type/Size structure with no Brand/Series and no stored GST. */
export type ProductType = "paint" | "accessory";

/** One Type/Size variant within an Accessory Section, e.g. { name: "4 Inch", retailPrice: 450 }.
 *  Unlike Paint packaging options, accessory variants carry no GST — GST for accessories is
 *  entered manually per invoice line, defaulting to 0%. */
export interface AccessoryVariant {
  id: string;
  name: string;
  retailPrice: number;
}

/** A user-defined Accessory Section (e.g. Brush, Roller, Patra, Sandpaper, Tape). Section
 *  names and their Type/Size variant names are entirely free text chosen by the user —
 *  nothing here is hard-coded. */
export interface AccessorySection {
  id: string;
  sectionName: string;
  variants: AccessoryVariant[];
  status: ProductStatus;
  searchTokens: string[];
  createdAt: number;
  updatedAt: number;
}
