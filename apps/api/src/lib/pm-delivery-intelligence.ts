export type PmRiskLevel = "healthy" | "watch" | "at_risk" | "critical";

export type PmProjectSignal = {
  code: string;
  tone: "info" | "warning" | "danger";
  message: string;
};

export type PmProjectHealth = {
  projectId: string;
  projectName: string;
  status: string;
  healthScore: number;
  riskLevel: PmRiskLevel;
  progressPercent: number | null;
  openTasks: number;
  blockedTasks: number;
  overdueMilestones: number;
  pendingCheckIns: number;
  reportsLast7Days: number;
  hasSuccessCriteria: boolean;
  signals: PmProjectSignal[];
  recommendedActions: string[];
};

export type PmIntelligencePayload = {
  generatedAt: string;
  orgSummary: {
    averageHealth: number;
    atRiskCount: number;
    criticalCount: number;
    overdueMilestones: number;
    silentDevelopers: number;
  };
  priorities: PmProjectHealth[];
  projects: PmProjectHealth[];
};

type MilestoneRow = {
  id: string;
  name: string;
  dueDate: Date | null;
  status: string;
};

type TaskRow = {
  status: string;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  successCriteria: string | null;
  managementProgressPercent: number | null;
  milestones: MilestoneRow[];
  tasks: TaskRow[];
};

function riskFromScore(score: number): PmRiskLevel {
  if (score >= 75) return "healthy";
  if (score >= 55) return "watch";
  if (score >= 35) return "at_risk";
  return "critical";
}

function daysOverdue(due: Date): number {
  const ms = Date.now() - due.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function scoreProjectHealth(input: {
  project: ProjectRow;
  pendingCheckIns: number;
  reportsLast7Days: number;
  developerCount: number;
}): PmProjectHealth {
  const { project, pendingCheckIns, reportsLast7Days, developerCount } = input;
  let score = 100;
  const signals: PmProjectSignal[] = [];
  const actions: string[] = [];

  const now = Date.now();
  const overdue = project.milestones.filter(
    (m) => m.status !== "completed" && m.dueDate && m.dueDate.getTime() < now
  );
  const blocked = project.tasks.filter((t) => t.status === "blocked").length;
  const openTasks = project.tasks.filter((t) => ["todo", "in_progress", "blocked"].includes(t.status)).length;

  if (!project.successCriteria?.trim()) {
    score -= 12;
    signals.push({
      code: "no_success_criteria",
      tone: "warning",
      message: "Success criteria not defined — delivery goal is unclear."
    });
    actions.push("Define success criteria so the team knows what done looks like.");
  }

  if (overdue.length > 0) {
    const worst = Math.max(...overdue.map((m) => (m.dueDate ? daysOverdue(m.dueDate) : 0)));
    score -= Math.min(35, 10 + overdue.length * 6 + Math.floor(worst / 3));
    signals.push({
      code: "overdue_milestones",
      tone: worst > 7 ? "danger" : "warning",
      message: `${overdue.length} milestone${overdue.length === 1 ? "" : "s"} past due${worst > 0 ? ` (up to ${worst}d)` : ""}.`
    });
    actions.push("Run a short retro: slip reason, scope cut, or new milestone dates.");
  }

  if (blocked > 0) {
    score -= Math.min(20, blocked * 8);
    signals.push({
      code: "blocked_tasks",
      tone: "danger",
      message: `${blocked} blocked task${blocked === 1 ? "" : "s"} need PM unblock.`
    });
    actions.push("Escalate blockers in Talks and assign an owner to clear them today.");
  }

  if (pendingCheckIns > 0) {
    score -= Math.min(15, pendingCheckIns * 5);
    signals.push({
      code: "pending_checkins",
      tone: "warning",
      message: `${pendingCheckIns} daily check-in${pendingCheckIns === 1 ? "" : "s"} awaiting developer reply.`
    });
    actions.push("Follow up in Talks — silent devs often mean hidden risk.");
  }

  if (developerCount > 0 && reportsLast7Days === 0) {
    score -= 18;
    signals.push({
      code: "no_recent_reports",
      tone: "warning",
      message: "No developer reports in the last 7 days on this project."
    });
    actions.push("Request a short status via check-in or daily report.");
  } else if (developerCount > 0 && reportsLast7Days < developerCount) {
    score -= 8;
    signals.push({
      code: "thin_reporting",
      tone: "info",
      message: "Reporting coverage is partial this week."
    });
  }

  if (project.status === "active" && openTasks === 0 && overdue.length === 0) {
    signals.push({
      code: "no_open_tasks",
      tone: "info",
      message: "No open tasks — confirm backlog is defined for the sprint."
    });
    actions.push("Break the next milestone into assignable tasks.");
  }

  if (project.managementProgressPercent != null && project.managementProgressPercent < 30 && overdue.length > 0) {
    score -= 10;
    signals.push({
      code: "low_progress_high_slip",
      tone: "danger",
      message: "Low progress with overdue milestones — consider scope negotiation."
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel = riskFromScore(score);

  if (riskLevel === "critical" && !actions.some((a) => a.includes("retro"))) {
    actions.unshift("Treat as sprint intervention: daily sync until milestones recover.");
  }

  return {
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    healthScore: score,
    riskLevel,
    progressPercent: project.managementProgressPercent,
    openTasks,
    blockedTasks: blocked,
    overdueMilestones: overdue.length,
    pendingCheckIns,
    reportsLast7Days,
    hasSuccessCriteria: Boolean(project.successCriteria?.trim()),
    signals,
    recommendedActions: [...new Set(actions)].slice(0, 4)
  };
}

export function buildIntelligencePayload(
  projects: PmProjectHealth[]
): Omit<PmIntelligencePayload, "generatedAt"> {
  const sorted = [...projects].sort((a, b) => a.healthScore - b.healthScore);
  const priorities = sorted.filter((p) => p.riskLevel !== "healthy").slice(0, 6);
  const avg =
    projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length)
      : 100;

  return {
    orgSummary: {
      averageHealth: avg,
      atRiskCount: projects.filter((p) => p.riskLevel === "at_risk" || p.riskLevel === "critical").length,
      criticalCount: projects.filter((p) => p.riskLevel === "critical").length,
      overdueMilestones: projects.reduce((s, p) => s + p.overdueMilestones, 0),
      silentDevelopers: projects.filter((p) => p.pendingCheckIns > 0).length
    },
    priorities: priorities.length > 0 ? priorities : sorted.slice(0, 3),
    projects: sorted
  };
}
