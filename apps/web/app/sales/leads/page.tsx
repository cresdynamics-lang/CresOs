import { redirect } from "next/navigation";

/** Leads live at `/leads`; kept for old links. */
export default function SalesLeadsRedirectPage() {
  redirect("/leads");
}
