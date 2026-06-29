import assert from "node:assert/strict";
import {
  buildEmotionalCheckIn,
  buildEngagingWelcomeMessage,
  formatSessionDuration
} from "./engaging-welcome";

function run() {
  assert.equal(formatSessionDuration(0), "a few minutes");
  assert.equal(formatSessionDuration(90), "1h 30m");
  assert.equal(formatSessionDuration(600), "10 hours");

  const noon = new Date("2026-05-30T12:00:00.000Z");
  const longSession = buildEngagingWelcomeMessage({
    firstName: "Pat",
    activeMinutes: 600,
    criticalProjects: 0,
    pendingCheckIns: 0,
    overdueMilestones: 0,
    now: noon
  });
  assert.ok(!longSession.toLowerCase().includes("break"), `unexpected break copy: ${longSession}`);
  assert.ok(
    /hope you're|hope you are|doing okay|holding up|headspace|alright/i.test(longSession),
    `expected emotional tone: ${longSession}`
  );

  const critical = buildEngagingWelcomeMessage({
    firstName: "Pat",
    activeMinutes: 120,
    criticalProjects: 2,
    now: noon
  });
  assert.ok(critical.includes("2 projects"));
  assert.ok(!critical.toLowerCase().includes("break"));

  const emotional = buildEmotionalCheckIn("Pat", "Good afternoon", "10 hours", noon, "moderate");
  assert.ok(!emotional.toLowerCase().includes("break"));
  assert.ok(/hope you're|hope you are/i.test(emotional));

  console.log("engaging-welcome.test.ts: ok");
}

run();
