import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Cres Dynamics - CresOS Business Operating System",
  description: "Your CresOS command center by Cres Dynamics. View real-time business metrics, KPIs, leads, projects, and financial health in one dashboard.",
  keywords: ["Cres Dynamics dashboard", "CresOS dashboard", "Business OS analytics", "CRM dashboard", "KPI tracking", "Business metrics"],
  openGraph: {
    title: "Dashboard | Cres Dynamics - CresOS",
    description: "Real-time business command center - Track your KPIs and growth"
  }
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
