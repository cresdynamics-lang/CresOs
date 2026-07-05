import type { PrismaClient } from "@prisma/client";
import { getAcceptedDeveloperIds } from "./project-access";
import { buildIntelligencePayload, scoreProjectHealth } from "./pm-delivery-intelligence";
import { buildKnowledgeContextBlock } from "./knowledge-context";
import { formatTeamUsersBlock, findOrgUsersForKnowledgeSearch } from "./knowledge-team-index";
import { getWebsiteContext } from "./website-context";

export async function buildAdminAssistantContextBlock(
  prisma: PrismaClient,
  orgId: string,
  userMessage?: string
): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [projects, websiteContext, knowledgeBlock, poolStats] = await Promise.all([
    prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      select: {
        id: true,
        name: true,
        status: true,
        successCriteria: true,
        managementProgressPercent: true,
        assignedDeveloper: { select: { id: true, name: true, email: true } },
        milestones: { select: { id: true, name: true, dueDate: true, status: true } },
        tasks: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true, estimatedHours: true, actualHours: true, assignee: { select: { name: true, email: true } } },
          take: 40
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 25
    }),
    getWebsiteContext(),
    userMessage?.trim()
      ? buildKnowledgeContextBlock(prisma, orgId, { q: userMessage.trim(), sinceDays: 0, limit: 25 })
      : buildKnowledgeContextBlock(prisma, orgId, { sinceDays: 14, limit: 20 }),
    prisma.knowledgeChunk.count({ where: { orgId } })
  ]);

  const projectIds = projects.map((p) => p.id);
  const recentReports = await prisma.developerReport.findMany({
    where: { orgId, reportDate: { gte: thirtyDaysAgo } },
    select: {
      reportDate: true,
      implemented: true,
      pending: true,
      blockers: true,
      submittedBy: { select: { name: true, email: true } }
    },
    orderBy: { reportDate: "desc" },
    take: 20
  });

  const recentReportsWeek = await prisma.developerReport.findMany({
    where: { orgId, reportDate: { gte: weekAgo } },
    select: { submittedById: true }
  });
  const devsWhoReported = new Set(recentReportsWeek.map((r) => r.submittedById));

  const [pendingByProject, devCounts] = await Promise.all([
    prisma.pmDeveloperCheckIn.groupBy({
      by: ["projectId"],
      where: { orgId, status: "pending", projectId: { in: projectIds } },
      _count: { _all: true }
    }),
    Promise.all(
      projects.map(async (p) => {
        const devIds = await getAcceptedDeveloperIds(prisma, p.id);
        const reportsLast7Days = devIds.filter((id) => devsWhoReported.has(id)).length;
        return { projectId: p.id, count: devIds.length, reportsLast7Days, devIds };
      })
    )
  ]);

  const pendingMap = Object.fromEntries(pendingByProject.map((r) => [r.projectId, r._count._all]));
  const devMap = Object.fromEntries(devCounts.map((r) => [r.projectId, r.count]));
  const reportsMap = Object.fromEntries(devCounts.map((r) => [r.projectId, r.reportsLast7Days]));

  const scored = projects.map((p) =>
    scoreProjectHealth({
      project: p,
      pendingCheckIns: pendingMap[p.id] ?? 0,
      reportsLast7Days: reportsMap[p.id] ?? 0,
      developerCount: devMap[p.id] ?? 0
    })
  );
  const intel = buildIntelligencePayload(scored);

  const projectLines = projects.map((p) => {
    const health = scored.find((s) => s.projectId === p.id);
    const dev = p.assignedDeveloper?.name || p.assignedDeveloper?.email || "unassigned";
    const openTasks = p.tasks.filter((t) => !["done", "completed"].includes(t.status));
    const taskSnip = openTasks
      .slice(0, 5)
      .map((t) => {
        const who = t.assignee?.name || t.assignee?.email || "?";
        const hrs = t.estimatedHours != null ? ` est ${t.estimatedHours}h` : "";
        return `    - ${t.title} (${t.status}, ${who}${hrs})`;
      })
      .join("\n");
    return [
      `• ${p.name} [${p.status}] health ${health?.healthScore ?? "?"}/100 risk ${health?.riskLevel ?? "?"}`,
      `  Lead dev: ${dev} | progress ${p.managementProgressPercent ?? "?"}%`,
      health?.signals?.length ? `  Signals: ${health.signals.map((s) => s.message).join("; ")}` : null,
      taskSnip ? `  Open tasks:\n${taskSnip}` : null
    ]
      .filter(Boolean)
      .join("\n");
  });

  const reportLines = recentReports.slice(0, 12).map((r) => {
    const who = r.submittedBy?.name || r.submittedBy?.email || "Developer";
    const body = [r.implemented, r.pending, r.blockers].filter(Boolean).join(" | ").slice(0, 200);
    return `- ${who} ${r.reportDate.toISOString().slice(0, 10)}: ${body}`;
  });

  let teamBlock = "";
  if (userMessage?.trim()) {
    const matched = await findOrgUsersForKnowledgeSearch(prisma, orgId, userMessage.trim());
    if (matched.length) teamBlock = formatTeamUsersBlock(matched);
  }

  const sections = [
    `ORG PROJECT HEALTH (${intel.orgSummary.averageHealth}/100 avg, ${intel.orgSummary.atRiskCount} at-risk, ${intel.orgSummary.criticalCount} critical)`,
    projectLines.join("\n") || "(no approved projects)",
    "",
    "RECENT DEVELOPER REPORTS (30d):",
    reportLines.join("\n") || "(none)",
    "",
    `KNOWLEDGE POOL (${poolStats} indexed items):`,
    knowledgeBlock,
    teamBlock ? `\nMATCHED TEAM:\n${teamBlock}` : "",
    websiteContext
      ? `\nCRES DYNAMICS WEBSITE (cresdynamics.com):\n${websiteContext.slice(0, 6000)}`
      : ""
  ];

  return sections.join("\n");
}
