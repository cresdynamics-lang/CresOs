import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { AuthGuard } from "./auth-guard";

export const metadata = {
  title: "CresOS – Operating System for Growth",
  description:
    "CresOS connects visibility → leads → deals → delivery → invoices → revenue → analytics in one workflow."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <AuthProvider>
          <AuthGuard>{children}</AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}


