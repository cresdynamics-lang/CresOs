import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance | Cres Dynamics - CresOS Business Operating System",
  description: "Manage your business finances with CresOS by Cres Dynamics. Track invoices, payments, expenses, revenue, and financial reports in one integrated system.",
  keywords: ["Cres Dynamics finance", "CresOS finance", "Business OS accounting", "Invoice management", "Payment tracking", "Revenue analytics", "Financial reports"],
  openGraph: {
    title: "Finance | Cres Dynamics - CresOS",
    description: "Complete financial management - Invoices, payments, and revenue tracking"
  }
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
