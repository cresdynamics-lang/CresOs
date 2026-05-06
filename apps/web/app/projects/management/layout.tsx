import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Management | Cres Dynamics - Managed Projects & Billing",
  description: "Manage active projects with billing and progress tracking in CresOS by Cres Dynamics. Track management fees, monthly payments, and project status.",
  keywords: ["Cres Dynamics project management", "CresOS managed projects", "Project billing", "Management fees", "Project tracking", "Monthly billing"],
  openGraph: {
    title: "Project Management | Cres Dynamics - Managed Projects",
    description: "Managed projects - Track billing, progress, and payments"
  }
};

export default function ProjectManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
