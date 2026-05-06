import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | Cres Dynamics - CresOS Business Operating System",
  description: "Manage projects efficiently with CresOS by Cres Dynamics. Track milestones, tasks, team assignments, and project financials in your business operating system.",
  keywords: ["Cres Dynamics projects", "CresOS project management", "Business OS projects", "Task management", "Project tracking", "Team collaboration"],
  openGraph: {
    title: "Projects | Cres Dynamics - CresOS",
    description: "Project management - Track milestones, tasks, and delivery"
  }
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
