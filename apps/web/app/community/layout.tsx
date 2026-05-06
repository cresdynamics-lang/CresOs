import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community | Cres Dynamics - Team Communication & Collaboration",
  description: "Connect with your team on CresOS by Cres Dynamics. Community features for team communication, collaboration, and knowledge sharing.",
  keywords: ["Cres Dynamics community", "CresOS collaboration", "Team communication", "Business chat", "Team collaboration", "Workspace community"],
  openGraph: {
    title: "Community | Cres Dynamics - Team Collaboration",
    description: "Team community - Collaborate and communicate with your team"
  }
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
