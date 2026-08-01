"use client";

import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/layout/Sidebar";

// Single source of truth for which permission each area of the ERP requires.
// This used to be duplicated inside every page (each page wrapped itself in its own
// <ProtectedRoute>), which meant every navigation unmounted/remounted a fresh gate and
// could very briefly render without the shared shell — that's what caused the sidebar to
// flicker/resize/drop items when moving between pages. Permission is now resolved once,
// here, against the current pathname, and applied to the ONE ProtectedRoute that wraps the
// ONE Sidebar for the entire authenticated app. The Sidebar/shell element never unmounts
// between dashboard pages; only `{children}` (the page content) swaps out.
const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/dashboard", permission: "dashboard.view" },
  { prefix: "/products", permission: "products.manage" },
  { prefix: "/customers", permission: "customers.manage" },
  { prefix: "/invoices", permission: "invoices.create" },
  { prefix: "/payments", permission: "payments.receive" },
  { prefix: "/settings", permission: "settings.manage" }
  // Anything not listed (e.g. /profile/change-password) just needs to be signed in —
  // no extra permission required, same as before.
];

function permissionForPath(pathname: string): string | undefined {
  const match = ROUTE_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return match?.permission;
}

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const requiredPermission = permissionForPath(pathname);

  return (
    <ProtectedRoute requiredPermission={requiredPermission}>
      <div className="flex min-h-screen bg-ink-50 dark:bg-ink-950">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ProtectedRoute>
  );
}
