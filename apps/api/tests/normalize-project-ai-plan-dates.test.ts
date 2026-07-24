import { describe, expect, it } from "vitest";
import { normalizeProjectAiPlanDates } from "../src/lib/normalize-project-ai-plan-dates";
import type { ProjectAiPlan } from "../src/lib/project-ai-plan-types";

const anchor = new Date("2026-07-22T10:00:00.000Z");

const stalePlan: ProjectAiPlan = {
  projectSummary: "Test",
  projectDetails: "Details",
  successCriteria: "Done",
  agileSprintNotes: "",
  timeline: [{ title: "Launch", date: "2024-06-01" }],
  sprints: [
    {
      name: "Sprint 1",
      goal: "Build",
      startDate: "2024-01-01",
      endDate: "2024-03-01",
      milestones: [
        {
          name: "M1",
          dueDate: "2024-02-01",
          tasks: [
            { title: "Task A", dueDate: "2024-01-15" },
            { title: "Task B", dueDate: "2024-01-20" }
          ]
        },
        {
          name: "M2",
          dueDate: "2024-04-01",
          tasks: [{ title: "Task C", dueDate: "2024-03-15" }]
        },
        {
          name: "M3",
          dueDate: "2024-06-01",
          tasks: [{ title: "Task D" }, { title: "Task E" }]
        }
      ]
    }
  ],
  roleBriefs: {
    developers: "",
    sales: "",
    director: "",
    projectManager: ""
  }
};

describe("normalizeProjectAiPlanDates", () => {
  it("anchors milestones every 2 days from creation day", () => {
    const plan = normalizeProjectAiPlanDates(stalePlan, { anchorDate: anchor });
    const ms = plan.sprints[0].milestones;
    expect(ms[0].dueDate).toBe("2026-07-22");
    expect(ms[1].dueDate).toBe("2026-07-24");
    expect(ms[2].dueDate).toBe("2026-07-26");
  });

  it("never leaves 2024 dates on milestones or tasks", () => {
    const plan = normalizeProjectAiPlanDates(stalePlan, { anchorDate: anchor });
    for (const sprint of plan.sprints) {
      for (const milestone of sprint.milestones) {
        expect(milestone.dueDate?.startsWith("2024")).toBe(false);
        for (const task of milestone.tasks) {
          expect(task.dueDate?.startsWith("2024")).toBe(false);
        }
      }
    }
  });

  it("distributes tasks between milestone breakpoints", () => {
    const plan = normalizeProjectAiPlanDates(stalePlan, { anchorDate: anchor });
    const m2Tasks = plan.sprints[0].milestones[1].tasks;
    expect(m2Tasks[0].dueDate).toBe("2026-07-24");
    const m3Tasks = plan.sprints[0].milestones[2].tasks;
    expect(m3Tasks[0].dueDate).toBe("2026-07-25");
    expect(m3Tasks[1].dueDate).toBe("2026-07-26");
  });
});
