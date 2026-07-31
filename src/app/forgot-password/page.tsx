"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const { sendReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendReset(email.trim());
      setSent(true);
    } catch {
      // Avoid confirming whether an email exists — show the same success state either way.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-200">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <div className="card">
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <MailCheck className="mb-3 h-10 w-10 text-swatch-moss" />
              <h2 className="text-lg font-semibold">Check your inbox</h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                If an account exists for {email || "that email"}, a reset link has been sent.
              </p>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
              <p className="mb-5 text-sm text-ink-500 dark:text-ink-400">
                Enter your account email and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input"
                    placeholder="you@shop.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
