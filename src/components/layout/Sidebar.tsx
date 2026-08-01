"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, PaintBucket, KeyRound, PackageSearch, FileText, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/types";

const SWATCHES = ["#C1552E", "#D9A441", "#4C7B5A", "#2E7D8C", "#6C4E8C"];

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/products", label: "Products", icon: PackageSearch, permission: "products.manage" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers.manage" },
  { href: "/invoices", label: "Invoices", icon: FileText, permission: "invoices.create" },
  { href: "/payments", label: "Payments", icon: Wallet, permission: "payments.receive" },
  { href: "/settings", label: "Shop Settings", icon: Settings, permission: "settings.manage" }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { appUser } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900 lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <PaintBucket className="h-4.5 w-4.5" />
        </div>
        <span className="font-display text-base font-semibold">Paint Dealer ERP</span>
      </div>
      <div className="swatch-strip mx-5 mb-4">
        {SWATCHES.map((c) => (
          <span key={c} style={{ backgroundColor: c }} />
        ))}
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.filter((item) => hasPermission(appUser?.role, item.permission)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-200 p-3 dark:border-ink-800">
        <Link
          href="/profile/change-password"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <KeyRound className="h-4.5 w-4.5" />
          Change Password
        </Link>
      </div>
    </aside>
  );
}
