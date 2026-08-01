import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";

// Loaded via <link> rather than next/font/google so `next build` never depends on
// reaching fonts.googleapis.com — safer for CI, offline, and restricted-network setups.
export const metadata: Metadata = {
  title: "Paint Dealer ERP",
  description: "Smart Invoice & ERP platform for paint dealers"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-ink-50 text-ink-900 dark:bg-ink-950 dark:text-ink-100 antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
