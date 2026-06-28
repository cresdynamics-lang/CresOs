import type { Metadata } from "next";
import { ContextualWorkspaceLayoutClient } from "../../components/workspace/contextual-workspace-layout-client";

export const metadata: Metadata = {
  title: "Tasks & Schedule | Cres Dynamics - Task Management",
  description: "Organize work with CresOS by Cres Dynamics. Manage tasks, schedules, deadlines, and team assignments in your business operating system.",
  keywords: ["Cres Dynamics tasks", "CresOS schedule", "Task management", "Work planning", "Team scheduling", "Project tasks", "Deadline tracking"],
  openGraph: {
    title: "Tasks & Schedule | Cres Dynamics - Task Management",
    description: "Task management - Schedule work and track deadlines"
  }
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return <ContextualWorkspaceLayoutClient>{children}</ContextualWorkspaceLayoutClient>;
}
