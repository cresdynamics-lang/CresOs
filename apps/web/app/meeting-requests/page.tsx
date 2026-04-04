"use client";

import { MeetingRequestsPanel } from "../../components/meeting-requests-panel";

export default function MeetingRequestsPage() {
  return (
    <section className="flex flex-col gap-4">
      <MeetingRequestsPanel />
    </section>
  );
}
