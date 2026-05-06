import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Reports | Cres Dynamics - Team Performance Reports",
  description: "Track developer and team performance with CresOS by Cres Dynamics. Monitor productivity, project contributions, and work completion metrics.",
  keywords: ["Cres Dynamics developer reports", "Team performance", "Developer metrics", "Productivity tracking", "Team analytics", "Performance reports"],
  openGraph: {
    title: "Developer Reports | Cres Dynamics - Team Performance",
    description: "Developer reports - Track team productivity and contributions"
  }
};

export default function DeveloperReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
