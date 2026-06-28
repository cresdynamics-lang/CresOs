import type { Metadata } from "next";
import { PmLayoutClient } from "./pm-layout-client";

export const metadata: Metadata = {
  title: "Project Management | Cres Dynamics - CresOS",
  description: "Agile delivery, milestones, team check-ins, and project success tracking."
};

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return <PmLayoutClient>{children}</PmLayoutClient>;
}
