import type { Metadata } from "next";
import { HrLayoutClient } from "./hr-layout-client";

export const metadata: Metadata = {
  title: "HR | Cres Dynamics - CresOS",
  description: "Manage employees, roles, reporting lines, and payroll with CresOS HR workspace."
};

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return <HrLayoutClient>{children}</HrLayoutClient>;
}
