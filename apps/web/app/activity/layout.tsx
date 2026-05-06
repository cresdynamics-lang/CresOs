import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity | Cres Dynamics - Activity Feed & Notifications",
  description: "Stay updated with CresOS by Cres Dynamics. View activity feed, notifications, and system updates across your business operating system.",
  keywords: ["Cres Dynamics activity", "CresOS notifications", "Activity feed", "System updates", "Business activity", "Workspace notifications"],
  openGraph: {
    title: "Activity | Cres Dynamics - Activity Feed",
    description: "Activity feed - Track updates and notifications"
  }
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
