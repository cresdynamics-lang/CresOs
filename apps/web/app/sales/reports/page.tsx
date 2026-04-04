import { redirect } from "next/navigation";

/** Sales activity reports live at `/reports`; this path kept for old links and sidebar consistency. */
export default function SalesReportsRedirectPage() {
  redirect("/reports");
}
