import { describe, expect, it } from "vitest";
import { countPlanMilestones, countPlanTasks } from "../src/lib/project-ai-plan-types";
import type { ProjectAiPlan } from "../src/lib/project-ai-plan-types";

const samplePlan: ProjectAiPlan = {
  projectSummary: "Retail POS rollout",
  successCriteria: "99% uptime",
  agileSprintNotes: "3 two-week sprints",
  timeline: [{ title: "Go live", date: "2026-08-01" }],
  sprints: [
    {
      name: "Sprint 1",
      goal: "Core POS",
      milestones: [
        {
          name: "Checkout module",
          tasks: [{ title: "API auth" }, { title: "Cart UI" }]
        },
        {
          name: "Inventory sync",
          tasks: [{ title: "Stock webhook" }]
        }
      ]
    },
    {
      name: "Sprint 2",
      goal: "Reporting",
      milestones: [{ name: "Dashboards", tasks: [{ title: "Sales chart" }] }]
    }
  ],
  roleBriefs: {
    developers: "Focus on API first",
    sales: "Client expects Aug launch",
    director: "Approve sprint scope",
    projectManager: "Track daily standups"
  }
};

describe("project-ai-plan-types", () => {
  it("counts milestones across sprints", () => {
    expect(countPlanMilestones(samplePlan)).toBe(3);
  });

  it("counts tasks across milestones", () => {
    expect(countPlanTasks(samplePlan)).toBe(4);
  });
});
