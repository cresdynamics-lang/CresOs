import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Workspace | Cres Dynamics - CresOS Business OS",
  description: "Get started with CresOS by Cres Dynamics. Create your workspace and unlock the complete Business Operating System with integrated CRM, finance, and project management.",
  keywords: ["Cres Dynamics signup", "CresOS register", "Business OS free trial", "CRM setup", "Create CresOS workspace"],
  openGraph: {
    title: "Create Workspace | Cres Dynamics - CresOS",
    description: "Start your journey with Cres Dynamics - Set up your Business Operating System"
  }
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
