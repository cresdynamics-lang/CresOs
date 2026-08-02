import { redirect } from "next/navigation";

export default function AdminRolesRedirect() {
  redirect("/admin/organisation?tab=roles");
}
