import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Cres Dynamics - CresOS Business Operating System",
  description: "Sign in to CresOS by Cres Dynamics. Access your business operating system workspace with CRM, project management, finance tools, and analytics.",
  keywords: ["Cres Dynamics login", "CresOS sign in", "Business OS login", "CRM login", "Cres CRM access"],
  openGraph: {
    title: "Sign In | Cres Dynamics - CresOS",
    description: "Access your Cres Dynamics workspace - Business Operating System & CRM Platform"
  }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
