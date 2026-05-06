import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM | Cres Dynamics - Customer Relationship Management",
  description: "Cres CRM by Cres Dynamics - Complete customer relationship management integrated in CresOS. Track leads, clients, communications, and sales opportunities.",
  keywords: ["Cres CRM", "Cres Dynamics CRM", "Customer relationship management", "Lead management", "Client tracking", "Sales CRM", "Business CRM"],
  openGraph: {
    title: "CRM | Cres Dynamics - Customer Relationship Management",
    description: "Cres CRM - Manage leads, clients, and customer relationships"
  }
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
