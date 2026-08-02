import { redirect } from "next/navigation";

export default function AdminPlaybookRedirect() {
  redirect("/admin/ai-command?tab=playbook");
}
