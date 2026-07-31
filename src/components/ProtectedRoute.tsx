"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/types";

export default function ProtectedRoute({
  children,
  requiredPermission
}: {
  children: ReactNode;
  requiredPermission?: string;
}) {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }
    if (requiredPermission && !hasPermission(appUser.role, requiredPermission)) {
      router.replace("/dashboard");
    }
  }, [loading, appUser, requiredPermission, router]);

  if (loading || !appUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (requiredPermission && !hasPermission(appUser.role, requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}
