import type { Metadata } from "next";
import { SalesLayoutClient } from "./sales-layout-client";

export const metadata: Metadata = {
  title: "Sales Hub | Cres Dynamics - CresOS CRM & Sales Platform",
  description: "Accelerate sales with CresOS by Cres Dynamics. Manage leads, deals, opportunities, and customer relationships in the integrated CRM and sales platform.",
  keywords: ["Cres Dynamics sales", "CresOS CRM", "Cres CRM", "Sales management", "Lead tracking", "Deal pipeline", "Customer relationships"],
  openGraph: {
    title: "Sales Hub | Cres Dynamics - CresOS CRM",
    description: "CRM and sales management - Leads, deals, and customer relationships"
  }
};

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <SalesLayoutClient>{children}</SalesLayoutClient>;
}
