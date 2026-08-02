import { redirect } from "next/navigation";

export default function AdminClientPortalRedirect() {
  redirect("/admin/organisation?tab=clients");
}
