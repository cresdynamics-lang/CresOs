import type { Metadata } from "next";
import { AdminReportsHub } from "./admin-reports-hub";

export const metadata: Metadata = {
  title: "Reports | CresOS Admin",
  description: "Sales, developer, AI, finance, and leadership reports in one admin workspace."
};

export default function AdminReportsPage() {
  return <AdminReportsHub />;
}
