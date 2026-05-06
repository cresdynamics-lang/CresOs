import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports | Cres Dynamics - Business Reports & Analytics",
  description: "Generate comprehensive reports with CresOS by Cres Dynamics. Sales reports, developer reports, financial summaries, and custom business analytics.",
  keywords: ["Cres Dynamics reports", "CresOS analytics", "Sales reports", "Developer reports", "Financial reports", "Business reports", "Data insights"],
  openGraph: {
    title: "Reports | Cres Dynamics - Business Reports",
    description: "Comprehensive reporting - Sales, finance, and operational insights"
  }
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
