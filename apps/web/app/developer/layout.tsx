import type { Metadata } from "next";
import { DeveloperLayoutClient } from "./developer-layout-client";

export const metadata: Metadata = {
  title: "Developer workspace | CresOS",
  description: "Developer delivery dashboard — tasks, reports, and project context."
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return <DeveloperLayoutClient>{children}</DeveloperLayoutClient>;
}
