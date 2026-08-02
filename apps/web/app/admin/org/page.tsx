import { redirect } from "next/navigation";

export default function AdminOrgRedirect() {
  redirect("/admin/organisation?tab=departments");
}
