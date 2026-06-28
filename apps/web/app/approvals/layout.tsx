import type { Metadata } from "next";
import { FinanceLayoutClient } from "../finance/finance-layout-client";

export const metadata: Metadata = {
  title: "Approvals | Cres Dynamics - Workflow Approvals & Authorization",
  description:
    "Streamline approvals with CresOS by Cres Dynamics. Manage expense approvals, project approvals, and workflow authorizations in one place.",
  keywords: [
    "Cres Dynamics approvals",
    "CresOS workflow",
    "Expense approval",
    "Project approval",
    "Authorization workflow",
    "Business approvals"
  ],
  openGraph: {
    title: "Approvals | Cres Dynamics - Workflow Management",
    description: "Approval workflow - Manage authorizations and sign-offs"
  }
};

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return <FinanceLayoutClient>{children}</FinanceLayoutClient>;
}
