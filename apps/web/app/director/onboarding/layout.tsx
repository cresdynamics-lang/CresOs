import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Director playbook | CresOS",
  description: "Role playbook for Directors — expectations, escalations, and Cres Dynamics how-we-run."
};

export default function DirectorOnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
