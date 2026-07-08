import type { PrismaClient } from "@prisma/client";
import type { IntelligenceFocus } from "./admin-assistant-focus";
import { findOrgUsersForKnowledgeSearch } from "./knowledge-team-index";

const THIRTY_DAYS = 30 * 86_400_000;

function sumDecimalHours(values: Array<{ estimatedHours: unknown; actualHours: unknown }>): {
  estimated: number;
  actual: number;
} {
  let estimated = 0;
  let actual = 0;
  for (const t of values) {
    if (t.estimatedHours != null) estimated += Number(t.estimatedHours);
    if (t.actualHours != null) actual += Number(t.actualHours);
  }
  return { estimated: Math.round(estimated * 10) / 10, actual: Math.round(actual * 10) / 10 };
}

export async function buildIntelligenceFocusBlock(
  prisma: PrismaClient,
  orgId: string,
  focus: IntelligenceFocus,
  message: string
): Promise<string> {
  if (focus === "general") return "";

  const since = new Date(Date.now() - THIRTY_DAYS);
  const matched = await findOrgUsersForKnowledgeSearch(prisma, orgId, message);
  const userIds = matched.map((u) => u.id);

  if (focus === "person" || focus === "hours") {
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds }, orgId, deletedAt: null },
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
              currentFocusProject: { select: { id: true, name: true } }
            }
          })
        : [];

    const lines: string[] = [];
    for (const u of users.slice(0, 5)) {
      const label = u.name || u.email;
      const [reports, tasks, events] = await Promise.all([
        prisma.developerReport.findMany({
          where: { orgId, submittedById: u.id, reportDate: { gte: since } },
          select: { reportDate: true, implemented: true, pending: true, blockers: true },
          orderBy: { reportDate: "desc" },
          take: 15
        }),
        prisma.task.findMany({
          where: { orgId, assigneeId: u.id, deletedAt: null },
          select: { title: true, status: true, estimatedHours: true, actualHours: true, project: { select: { name: true } } },
          take: 20
        }),
        prisma.eventLog.count({
          where: { orgId, actorId: u.id, createdAt: { gte: since } }
        })
      ]);

      const reportDays = new Set(reports.map((r) => r.reportDate.toISOString().slice(0, 10))).size;
      const hrs = sumDecimalHours(tasks);
      const openTasks = tasks.filter((t) => !["done", "completed"].includes(t.status));

      const parts = [
        `PERSON: ${label} (id=${u.id})`,
        `  Role/title: ${u.jobTitle ?? "—"}`,
        `  Current focus: ${u.currentFocusProject?.name ?? "none"}`,
        `  Report days (30d): ${reportDays} / ${reports.length} reports filed`,
        `  Task hours — estimated ${hrs.estimated}h, actual ${hrs.actual}h, open tasks ${openTasks.length}`,
        `  Event log actions (30d): ${events}`,
        reports.length
          ? `  Latest report: ${reports[0]!.reportDate.toISOString().slice(0, 10)} — ${[reports[0]!.implemented, reports[0]!.pending, reports[0]!.blockers].filter(Boolean).join(" | ").slice(0, 180)}`
          : "  Latest report: none in 30d"
      ];
      if (openTasks.length) {
        parts.push(
          `  Open tasks: ${openTasks
            .slice(0, 4)
            .map((t) => `${t.title} (${t.project?.name ?? "?"})`)
            .join("; ")}`
        );
      }
      lines.push(...parts);
    }

    if (focus === "hours" && users.length === 0) {
      const orgTasks = await prisma.task.findMany({
        where: { orgId, deletedAt: null, updatedAt: { gte: since } },
        select: {
          title: true,
          estimatedHours: true,
          actualHours: true,
          assignee: { select: { name: true, email: true } },
          project: { select: { name: true } }
        },
        take: 25
      });
      const orgHrs = sumDecimalHours(orgTasks);
      lines.push(
        `ORG TASK HOURS (30d activity): estimated ${orgHrs.estimated}h total, actual ${orgHrs.actual}h`,
        ...orgTasks.slice(0, 8).map(
          (t) =>
            `- ${t.title} @ ${t.project?.name ?? "?"} (${t.assignee?.name ?? "?"}): est ${t.estimatedHours ?? "?"}h / actual ${t.actualHours ?? "?"}h`
        )
      );
    }

    return ["INTELLIGENCE FOCUS — PERSON/HOURS DATA:", ...lines.filter(Boolean)].join("\n");
  }

  if (focus === "services") {
    return "INTELLIGENCE FOCUS — Prioritize Cres Dynamics website context and map project descriptions to specific services, tiers, and delivery models.";
  }

  if (focus === "projects") {
    const atRisk = await prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved", status: { in: ["active", "planned"] } },
      select: {
        id: true,
        name: true,
        status: true,
        managementProgressPercent: true,
        assignedDeveloper: { select: { name: true, email: true } },
        tasks: {
          where: { deletedAt: null, status: { in: ["blocked", "in_progress"] } },
          select: { title: true, status: true },
          take: 5
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 15
    });
    return [
      "INTELLIGENCE FOCUS — PROJECT ROLLUP:",
      ...atRisk.map((p) => {
        const dev = p.assignedDeveloper?.name || p.assignedDeveloper?.email || "unassigned";
        const blocked = p.tasks.filter((t) => t.status === "blocked");
        return `• ${p.name} [${p.status}] id=${p.id} progress=${p.managementProgressPercent ?? "?"}% lead=${dev}${blocked.length ? ` BLOCKED: ${blocked.map((t) => t.title).join(", ")}` : ""}`;
      })
    ].join("\n");
  }

  return "";
}
