import "./globals.css";
import type { ReactNode } from "react";
import { Syne, DM_Sans, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "./auth-context";
import { AuthGuard } from "./auth-guard";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap"
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap"
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});

export const metadata = {
  title: "CresOS – Operating System for Growth",
  description:
    "CresOS connects visibility → leads → deals → delivery → invoices → revenue → analytics in one workflow."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-slate-950 text-slate-50 font-body antialiased">
        <AuthProvider>
          <AuthGuard>{children}</AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}


