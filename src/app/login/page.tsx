"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, PaintBucket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const SWATCHES = ["#C1552E", "#D9A441", "#4C7B5A", "#2E7D8C", "#6C4E8C"];

export default function LoginPage() {
  const { login, appUser, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && appUser) router.replace("/dashboard");
  }, [loading, appUser, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back");
      router.replace("/dashboard");
    } catch (err: any) {
      const message =
        err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password"
          ? "Incorrect email or password."
          : err?.code === "auth/user-not-found"
          ? "No account found with that email."
          : err?.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait and try again."
          : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl2 bg-brand-600 text-white shadow-card">
            <PaintBucket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink-900 dark:text-white">Paint Dealer ERP</h1>
            <p className="text-sm text-ink-500 dark:text-ink-400">Sign in to your shop account</p>
          </div>
        </div>

        <div className="card">
          <div className="swatch-strip mb-5">
            {SWATCHES.map((c) => (
              <span key={c} style={{ backgroundColor: c }} />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                className="input"
                placeholder="you@shop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">
                  Password
                </label>
                <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-ink-400">
          Access is provisioned by your shop admin. Contact them if you need an account.
        </p>
      </div>
    </div>
  );
}
