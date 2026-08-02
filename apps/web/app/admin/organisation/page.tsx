import type { Metadata } from "next";
import { AdminOrganisationHub } from "./admin-organisation-hub";

export const metadata: Metadata = {
  title: "Organisation | CresOS Admin",
  description: "Users, departments, roles, and client portal — one organisation workspace."
};

export default function AdminOrganisationPage() {
  return <AdminOrganisationHub />;
}
