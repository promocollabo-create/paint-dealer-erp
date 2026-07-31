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
