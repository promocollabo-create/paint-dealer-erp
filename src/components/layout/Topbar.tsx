"use client";

import { useState } from "react";
import { Menu, Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";
import MobileNavDrawer from "./MobileNavDrawer";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff"
};

export default function Topbar({ title }: { title: string }) {
  const { appUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-white px-3 dark:border-ink-800 dark:bg-ink-900 sm:h-16 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <h1 className="truncate text-base font-semibold text-ink-900 dark:text-white sm:text-lg">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="hidden items-center gap-2.5 border-l border-ink-200 pl-3 sm:flex dark:border-ink-700">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{appUser?.name}</p>
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                {ROLE_LABEL[appUser?.role ?? ""] ?? appUser?.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800 lg:flex"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
