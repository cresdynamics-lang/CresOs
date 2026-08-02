import type { Metadata } from "next";
import { AdminManagementHub } from "./admin-management-hub";

export const metadata: Metadata = {
  title: "Management | CresOS Admin",
  description: "Approvals, sales, projects, leads, CRM, and finance — one management workspace."
};

export default function AdminManagementPage() {
  return <AdminManagementHub />;
}
