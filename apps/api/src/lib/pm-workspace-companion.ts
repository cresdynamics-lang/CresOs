import type { PrismaClient } from "@prisma/client";
import Groq from "groq-sdk";
import { getAcceptedDeveloperIds } from "./project-access";
import { buildIntelligencePayload, scoreProjectHealth } from "./pm-delivery-intelligence";
import { resolveGroqModel } from "./groq-model";

export type CompanionNudge = {
  id: string;
  kind: "break" | "work" | "wellness" | "celebration" | "tip";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  dismissKey?: string;
};

export type PmWorkspaceCompanionPayload = {
  firstName: string;
  sessionStartedAt: string;
  serverSessionMinutes: number;
  work: {
    pendingCheckIns: number;
    criticalProjects: number;
    atRiskProjects: number;
    overdueMilestones: number;
    reportsToday: number;
    openTasks: number;
    orgHealth: number;
    activeProjects: number;
  };
  companionLine: string;
  nudges: CompanionNudge[];
  aiLine: string | null;
  aiGenerated: boolean;
};

const CHAT_MODEL = resolveGroqModel(
  process.env.GROQ_REMINDER_MODEL,
  process.env.GROQ_DIRECTOR_MODEL
);

function firstNameFrom(user: { name?: string | null; email?: string | null } | null): string {
  const n = user?.name?.trim();
  if (n) {
    const part = n.split(/\s+/)[0] ?? n;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  const local = user?.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (local) {
    const part = local.split(/\s+/)[0] ?? local;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  return "there";
}

function dayPart(h: number): "morning" | "afternoon" | "evening" | "night" {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h}h ${m}m`;
}

function emotionalCompanionLine(
  name: string,
  opener: string,
  duration: string,
  stress: "light" | "moderate" | "heavy"
): string {
  const pools = {
    light: [
      `${opener}, ${name} — hope you're doing okay today.`,
      `${name}, just checking in — hope you're feeling alright.`,
      `${opener}, ${name} — hope the day's treating you kindly.`
    ],
    moderate: [
      `${name}, hope you're holding up — you've been in the flow ${duration}.`,
      `${opener}, ${name} — hope you're in a good headspace; ${duration} is a real stretch.`,
      `${name}, hope you're doing okay — ${duration} in the workspace shows real commitment.`
    ],
    heavy: [
      `${name}, hope you're not feeling overwhelmed — ${duration} with a demanding queue is a lot.`,
      `${opener}, ${name} — hope you're alright; it's been ${duration} and there's plenty on your plate.`,
      `${name}, hope you're steady — ${duration} deep with pressure building is a lot for anyone.`
    ]
  };
  const pool = pools[stress];
  const idx = (name.length + duration.length) % pool.length;
  return pool[idx];
}

function buildCompanionLine(
  name: string,
  sessionMinutes: number,
  work: PmWorkspaceCompanionPayload["work"],
  now: Date
): string {
  const part = dayPart(now.getHours());
  const openers: Record<typeof part, string> = {
    morning: "Hope you're having a great morning",
    afternoon: "Hope you're having a productive afternoon",
    evening: "Hope you're having a good evening",
    night: "Hope you're doing okay tonight"
  };
  const opener = openers[part];
  const duration = formatHours(sessionMinutes);

  if (work.criticalProjects > 0) {
    if (sessionMinutes >= 90) {
      return `${opener}, ${name} — ${work.criticalProjects} project${work.criticalProjects === 1 ? " is" : "s are"} in critical state; hope you're holding up through ${duration}.`;
    }
    return `${opener}, ${name} — ${work.criticalProjects} project${work.criticalProjects === 1 ? " is" : "s are"} in critical state and need you first.`;
  }
  if (work.pendingCheckIns > 0) {
    return `${opener}, ${name} — ${work.pendingCheckIns} developer check-in${work.pendingCheckIns === 1 ? "" : "s"} waiting on your reply.`;
  }
  if (work.overdueMilestones > 0) {
    return `${opener}, ${name} — ${work.overdueMilestones} overdue milestone${work.overdueMilestones === 1 ? "" : "s"} on your radar.`;
  }
  if (sessionMinutes >= 120) {
    return emotionalCompanionLine(name, opener, duration, "moderate");
  }
  if (part === "night" && sessionMinutes >= 60) {
    return emotionalCompanionLine(name, opener, duration, "light");
  }
  if (work.activeProjects > 0) {
    return `${opener}, ${name} — ${work.activeProjects} active project${work.activeProjects === 1 ? "" : "s"}, org health ${work.orgHealth}/100.`;
  }
  if (sessionMinutes >= 30) {
    return emotionalCompanionLine(name, opener, duration, "light");
  }
  return `${opener}, ${name}.`;
}

function buildNudges(
  name: string,
  sessionMinutes: number,
  work: PmWorkspaceCompanionPayload["work"],
  now: Date
): CompanionNudge[] {
  const nudges: CompanionNudge[] = [];
  const h = now.getHours();

  if (sessionMinutes >= 120) {
    nudges.push({
      id: "emotional-check-in",
      kind: "wellness",
      title: "Checking in on you",
      message: `${name}, hope you're doing okay — long stretches can feel heavy. Pace yourself; delivery will still be here when you are.`,
      dismissKey: "wellness_emotional_snooze"
    });
  } else if (sessionMinutes >= 90) {
    nudges.push({
      id: "emotional-midday",
      kind: "wellness",
      title: "How are you feeling?",
      message: `${name}, hope you're in a good headspace — ${formatHours(sessionMinutes)} in and you're still showing up for the team.`,
      dismissKey: "wellness_emotional_snooze"
    });
  }

  if (h >= 21 && sessionMinutes >= 60) {
    nudges.push({
      id: "late-night",
      kind: "wellness",
      title: "Late session",
      message: `${name}, hope you're alright — it's getting late. Be kind to yourself; urgent items can wait for a clearer moment.`,
      dismissKey: "late_night"
    });
  }

  if (work.pendingCheckIns > 0) {
    nudges.push({
      id: "check-ins-pending",
      kind: "work",
      title: "Check-ins need you",
      message: `${work.pendingCheckIns} structured check-in${work.pendingCheckIns === 1 ? "" : "s"} still open — developers are waiting on your read in Community.`,
      actionLabel: "Open check-ins",
      actionHref: "/pm/check-ins"
    });
  }

  if (work.criticalProjects > 0) {
    nudges.push({
      id: "critical-projects",
      kind: "work",
      title: "Critical delivery",
      message: `${work.criticalProjects} project${work.criticalProjects === 1 ? " is" : "s are"} in critical health — run sprint recovery before the day fills up.`,
      actionLabel: "Review projects",
      actionHref: "/pm/projects"
    });
  }

  if (work.reportsToday >= 3 && h >= 14) {
    nudges.push({
      id: "reports-flow",
      kind: "celebration",
      title: "Team is reporting",
      message: `${work.reportsToday} developer reports filed today — good signal, ${name}. Scan them while context is fresh.`,
      actionLabel: "View reports",
      actionHref: "/pm/reports"
    });
  }

  if (work.orgHealth >= 85 && work.criticalProjects === 0 && work.overdueMilestones === 0) {
    nudges.push({
      id: "healthy-org",
      kind: "celebration",
      title: "Delivery looks healthy",
      message: `Org health ${work.orgHealth}/100 — keep check-ins flowing so you catch slips early, ${name}.`,
      actionLabel: "Send check-ins",
      actionHref: "/pm/check-ins"
    });
  }

  if (nudges.length === 0 && sessionMinutes < 30) {
    nudges.push({
      id: "welcome-tip",
      kind: "tip",
      title: `Welcome back, ${name}`,
      message: "I'll track live delivery signals and check-ins here — hope you're doing okay as you lead the team.",
      dismissKey: "welcome_tip"
    });
  }

  return nudges.slice(0, 4);
}

async function generateCompanionAiLine(
  name: string,
  sessionMinutes: number,
  work: PmWorkspaceCompanionPayload["work"]
): Promise<{ line: string | null; aiGenerated: boolean }> {
  const candidates = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
    process.env.GROQ_API_KEY_TERTIARY
  ];
  const key = candidates.find((k) => typeof k === "string" && k.trim().length > 0)?.trim();
  if (!key) return { line: null, aiGenerated: false };

  try {
    const client = new Groq({ apiKey: key });
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a warm, concise workspace companion for a project manager named ${name}.
Write ONE sentence (max 28 words) that feels personal — acknowledge how they might feel (steady, stretched, focused) based on session length or workload.
Include their first name. Never mention breaks, rest, or stepping away. Never mention AI. No markdown.`
        },
        {
          role: "user",
          content: JSON.stringify({
            name,
            sessionMinutes,
            pendingCheckIns: work.pendingCheckIns,
            criticalProjects: work.criticalProjects,
            overdueMilestones: work.overdueMilestones,
            orgHealth: work.orgHealth,
            reportsToday: work.reportsToday
          })
        }
      ],
      max_tokens: 80,
      temperature: 0.75
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    return raw ? { line: raw.replace(/^["']|["']$/g, ""), aiGenerated: true } : { line: null, aiGenerated: false };
  } catch {
    return { line: null, aiGenerated: false };
  }
}

export async function buildPmWorkspaceCompanion(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  sessionId?: string
): Promise<PmWorkspaceCompanionPayload> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [user, session, projects, openTasks, overdueMilestones, pendingCheckIns, reportsToday] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      sessionId
        ? prisma.session.findUnique({ where: { id: sessionId }, select: { createdAt: true } })
        : Promise.resolve(null),
      prisma.project.findMany({
        where: { orgId, deletedAt: null, approvalStatus: "approved" },
        select: {
          id: true,
          name: true,
          status: true,
          successCriteria: true,
          managementProgressPercent: true,
          milestones: { select: { id: true, name: true, dueDate: true, status: true } },
          tasks: { where: { deletedAt: null }, select: { status: true } }
        }
      }),
      prisma.task.count({
        where: {
          orgId,
          deletedAt: null,
          status: { in: ["todo", "in_progress", "blocked"] },
          project: { orgId, deletedAt: null, approvalStatus: "approved" }
        }
      }),
      prisma.milestone.count({
        where: {
          status: { in: ["pending", "in_progress"] },
          dueDate: { lt: now },
          project: { orgId, deletedAt: null, approvalStatus: "approved" }
        }
      }),
      prisma.pmDeveloperCheckIn.count({ where: { orgId, status: "pending" } }),
      prisma.developerReport.count({
        where: { orgId, reportDate: { gte: dayStart } }
      })
    ]);

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const projectIds = projects.map((p) => p.id);
  const recentReports = await prisma.developerReport.findMany({
    where: { orgId, reportDate: { gte: weekAgo } },
    select: { submittedById: true }
  });
  const devsWhoReported = new Set(recentReports.map((r) => r.submittedById));

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
        return { projectId: p.id, count: devIds.length, reportsLast7Days };
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
  const firstName = firstNameFrom(user);
  const sessionStartedAt = session?.createdAt?.toISOString() ?? now.toISOString();
  const serverSessionMinutes = session
    ? Math.max(0, Math.floor((now.getTime() - session.createdAt.getTime()) / 60_000))
    : 0;

  const work = {
    pendingCheckIns,
    criticalProjects: intel.orgSummary.criticalCount,
    atRiskProjects: intel.orgSummary.atRiskCount,
    overdueMilestones,
    reportsToday,
    openTasks,
    orgHealth: intel.orgSummary.averageHealth,
    activeProjects: projects.filter((p) => p.status === "active").length
  };

  const { line: aiLine, aiGenerated } = await generateCompanionAiLine(firstName, serverSessionMinutes, work);

  return {
    firstName,
    sessionStartedAt,
    serverSessionMinutes,
    work,
    companionLine: buildCompanionLine(firstName, serverSessionMinutes, work, now),
    nudges: buildNudges(firstName, serverSessionMinutes, work, now),
    aiLine,
    aiGenerated
  };
}
