"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut, PaintBucket, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/types";
import { NAV_ITEMS, SWATCHES } from "./Sidebar";

/** Mobile-only slide-out drawer, opened by the hamburger button in the Topbar. Mirrors the
 *  desktop Sidebar's nav list exactly (same permission filtering) plus Change Password and
 *  Logout, since those live in the sidebar footer on desktop but need a home in the drawer
 *  on mobile where the sidebar itself is hidden. Always closes after a selection. */
export default function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, logout } = useAuth();

  if (!open) return null;

  async function handleLogout() {
    onClose();
    await logout();
    router.replace("/login");
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-card dark:bg-ink-900">
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <PaintBucket className="h-4.5 w-4.5" />
            </div>
            <span className="font-display text-base font-semibold">Paint Dealer ERP</span>
          </div>
          <button onClick={onClose} className="p-1 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="swatch-strip mx-5 mb-4">
          {SWATCHES.map((c) => (
            <span key={c} style={{ backgroundColor: c }} />
          ))}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.filter((item) => hasPermission(appUser?.role, item.permission)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
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

        <div className="space-y-1 border-t border-ink-200 p-3 dark:border-ink-800">
          <Link
            href="/profile/change-password"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <KeyRound className="h-4.5 w-4.5" />
            Change Password
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-swatch-clay hover:bg-swatch-clay/10"
          >
            <LogOut className="h-4.5 w-4.5" />
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}
