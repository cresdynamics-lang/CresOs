import type { Metadata } from "next";
import { ClientLayoutClient } from "./client-layout-client";

export const metadata: Metadata = {
  title: "My projects | CresOS Client",
  description: "Track your project progress with Cres Dynamics."
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientLayoutClient>{children}</ClientLayoutClient>;
}
