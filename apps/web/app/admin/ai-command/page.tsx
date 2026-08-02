import type { Metadata } from "next";
import { AdminAiCommandHub } from "./admin-ai-hub";

export const metadata: Metadata = {
  title: "AI Command | CresOS Admin",
  description: "Playbook, AI intelligence, task creation, data pool, and email AI in one workspace."
};

export default function AdminAiCommandPage() {
  return <AdminAiCommandHub />;
}
