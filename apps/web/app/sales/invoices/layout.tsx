import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Invoices | Cres Dynamics - Invoice Management & Billing",
  description: "Manage sales invoices with CresOS by Cres Dynamics. Create, send, and track customer invoices, payments, and billing status.",
  keywords: ["Cres Dynamics invoices", "CresOS sales billing", "Invoice management", "Customer billing", "Sales invoices", "Payment tracking"],
  openGraph: {
    title: "Sales Invoices | Cres Dynamics - Invoice Management",
    description: "Sales invoices - Create and manage customer billing"
  }
};

export default function SalesInvoicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
