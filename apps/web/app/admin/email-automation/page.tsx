import type { Metadata } from "next";
import { EmailAutomationConsole } from "./email-automation-console";

export const metadata: Metadata = {
  title: "Email AI | CresOS Admin",
  description: "Inbox drafts, approvals, and email automation for the admin workspace."
};

export default function AdminEmailAutomationPage() {
  return <EmailAutomationConsole />;
}
