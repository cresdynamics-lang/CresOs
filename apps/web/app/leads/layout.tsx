import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leads | Cres Dynamics - Lead Management & Sales CRM",
  description: "Track and convert leads with CresOS by Cres Dynamics. Manage lead pipeline, qualify prospects, and accelerate sales in the integrated CRM system.",
  keywords: ["Cres Dynamics leads", "CresOS lead management", "Lead tracking", "Sales leads", "Prospect management", "Lead conversion", "CRM leads"],
  openGraph: {
    title: "Leads | Cres Dynamics - Lead Management",
    description: "Lead management - Track prospects and convert opportunities"
  }
};

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
