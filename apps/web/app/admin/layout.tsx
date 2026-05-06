import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Cres Dynamics - System Administration & User Management",
  description: "Administer your CresOS workspace by Cres Dynamics. Manage users, roles, departments, and system settings for your business operating system.",
  keywords: ["Cres Dynamics admin", "CresOS administration", "User management", "Role management", "System settings", "Workspace admin", "Business OS admin"],
  openGraph: {
    title: "Admin | Cres Dynamics - System Administration",
    description: "Administration - Manage users, roles, and workspace settings"
  }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
