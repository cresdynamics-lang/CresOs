import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Syne, DM_Sans, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "./auth-context";
import { AuthGuard } from "./auth-guard";
import { ThemeProvider } from "../lib/theme-provider";

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

export const metadata: Metadata = {
  title: "Cres Dynamics | CresOS - Business Operating System & CRM Platform",
  description:
    "Cres Dynamics presents CresOS - the complete Business Operating System with integrated CRM, project management, finance tracking, and analytics. Streamline leads, deals, delivery, invoices, and revenue in one powerful platform.",
  keywords: [
    "Cres Dynamics",
    "CresOS",
    "Cres CRM",
    "Business Operating System",
    "CRM Kenya",
    "Business Management Software",
    "Project Management",
    "Finance Management",
    "Lead Management",
    "Revenue Analytics"
  ],
  authors: [{ name: "Cres Dynamics" }],
  creator: "Cres Dynamics",
  publisher: "Cres Dynamics",
  robots: "index, follow",
  openGraph: {
    title: "Cres Dynamics | CresOS - Business Operating System & CRM",
    description: "The complete Business Operating System with integrated CRM, project management, and finance tracking.",
    type: "website",
    siteName: "Cres Dynamics - CresOS"
  },
  icons: {
    icon: [{ url: "/LOGO.jpg", type: "image/jpeg" }],
    shortcut: "/LOGO.jpg",
    apple: [{ url: "/LOGO.jpg", type: "image/jpeg" }]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-slate-950 font-body text-slate-50 antialiased">
        <ThemeProvider>
          <AuthProvider>
            <AuthGuard>{children}</AuthGuard>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


