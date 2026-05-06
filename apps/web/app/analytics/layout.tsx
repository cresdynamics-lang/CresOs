import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | Cres Dynamics - Business Intelligence & Reports",
  description: "Data-driven insights with CresOS by Cres Dynamics. View analytics, reports, KPIs, and business intelligence to make informed decisions.",
  keywords: ["Cres Dynamics analytics", "CresOS reports", "Business intelligence", "KPI dashboard", "Data analytics", "Business reports", "Performance metrics"],
  openGraph: {
    title: "Analytics | Cres Dynamics - Business Intelligence",
    description: "Analytics and reports - Data-driven business insights"
  }
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
