import { redirect } from "next/navigation";

/** CRM lives at `/crm`; this URL matches the Sales nav and old bookmarks. */
export default function SalesCrmRedirectPage() {
  redirect("/crm");
}
