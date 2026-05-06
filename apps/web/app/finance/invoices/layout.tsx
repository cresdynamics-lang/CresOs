import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance Invoices | Cres Dynamics - Financial Invoice Management",
  description: "Financial invoice management with CresOS by Cres Dynamics. Track all invoices, payments, revenue, and financial billing in one system.",
  keywords: ["Cres Dynamics finance invoices", "CresOS billing", "Financial invoices", "Revenue tracking", "Invoice payments", "Financial management"],
  openGraph: {
    title: "Finance Invoices | Cres Dynamics - Invoice Management",
    description: "Financial invoices - Complete billing and revenue tracking"
  }
};

export default function FinanceInvoicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
