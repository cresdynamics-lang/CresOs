/**
 * AI-generated alignment notifications: what's going on and how to bridge/align
 * work and tasks to hit expected targets. Sent to sales, developers, director, admin.
 * Uses Groq (env GROQ_API_KEY); throttled to once per 6 hours per org.
 */

import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";
import Groq from "groq-sdk";

const GROQ_MODEL = process.env.GROQ_REMINDER_MODEL ?? "llama-3.1-8b-instant";
const THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours
const NOTIFICATION_TYPE = "ai_alignment";

let groqClient: Groq | null = null;

function getClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key?.trim()) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: key });
  return groqClient;
}

type RoleMessage = { subject: string; body: string };

type AlignmentOutput = {
  sales?: RoleMessage;
  developer?: RoleMessage;
  director?: RoleMessage;
  admin?: RoleMessage;
};

async function getUserIdByRoleKeys(prisma: PrismaClient, orgId: string, roleKeys: string[]): Promise<string[]> {
  const memberIds = (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId);
  const roles = await prisma.role.findMany({
    where: { orgId, key: { in: roleKeys } },
    select: { id: true }
  });
  if (roles.length === 0) return [];
  const roleIds = roles.map((r) => r.id);
  const userIds = (await prisma.userRole.findMany({ where: { roleId: { in: roleIds } }, select: { userId: true } })).map((r) => r.userId);
  return [...new Set(memberIds.filter((id) => userIds.includes(id)))];
}

async function generateAlignment(prisma: PrismaClient, orgId: string): Promise<AlignmentOutput | null> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    tasks,
    developerReports,
    projects,
    scheduleItems,
    salesReports,
    meetingRequests,
    overdueTasks
  ] = await Promise.all([
    prisma.task.findMany({
      where: { orgId, deletedAt: null },
      select: { title: true, status: true, dueDate: true, assigneeId: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    prisma.developerReport.findMany({
      where: { orgId },
      orderBy: { reportDate: "desc" },
      take: 15,
      select: { reportDate: true, whatWorked: true, blockers: true, needsAttention: true, implemented: true, pending: true, nextPlan: true }
    }),
    prisma.project.findMany({
      where: { orgId, deletedAt: null },
      select: { name: true, status: true, approvalStatus: true, assignedDeveloperId: true },
      take: 30
    }),
    prisma.scheduleItem.findMany({
      where: { orgId, scheduledAt: { gte: now }, completedAt: null },
      orderBy: { scheduledAt: "asc" },
      take: 20,
      select: { title: true, type: true, scheduledAt: true }
    }),
    prisma.salesReport.findMany({
      where: { orgId, status: "submitted", submittedAt: { gte: sevenDaysAgo } },
      select: { submittedAt: true },
      take: 20
    }),
    prisma.meetingRequest.findMany({
      where: { orgId, status: "pending" },
      select: { reason: true, createdAt: true }
    }),
    prisma.task.findMany({
      where: { orgId, deletedAt: null, status: { not: "done" }, dueDate: { lt: now } },
      select: { title: true, dueDate: true }
    })
  ]);

  const taskSummary = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: overdueTasks.length,
    byStatus: tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>)
  };
  const recentBlockers = developerReports
    .filter((r) => r.blockers?.trim())
    .map((r) => r.blockers!.slice(0, 120))
    .slice(0, 5);
  const recentNeedsAttention = developerReports
    .filter((r) => r.needsAttention?.trim())
    .map((r) => r.needsAttention!.slice(0, 120))
    .slice(0, 5);
  const projectSummary = {
    total: projects.length,
    byStatus: projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>),
    approved: projects.filter((p) => p.approvalStatus === "approved").length
  };

  const context = {
    tasks: taskSummary,
    overdueTaskTitles: overdueTasks.slice(0, 10).map((t) => ({ title: t.title, due: t.dueDate })),
    developerReportsCount: developerReports.length,
    recentBlockers,
    recentNeedsAttention,
    projects: projectSummary,
    upcomingScheduleCount: scheduleItems.length,
    nextScheduleItems: scheduleItems.slice(0, 5).map((s) => ({ title: s.title, type: s.type, at: s.scheduledAt })),
    salesReportsLast7Days: salesReports.length,
    pendingMeetingRequests: meetingRequests.length
  };

  const client = getClient();
  if (!client) return null;

  const systemPrompt = `You are an alignment and operations coach for a team (sales, developers, director, admin). Given a JSON snapshot of the org's current state (tasks, reports, projects, schedule, meeting requests), produce a short, actionable alignment message for each role.

Output a JSON object only, with up to four keys: "sales", "developer", "director", "admin". Each value must be an object: { "subject": "Short subject under 60 chars", "body": "2-4 sentences: what's going on and 1-3 concrete steps to bridge gaps and align work to hit expected targets." }

Rules:
- Be specific to the data (mention blockers, overdue tasks, pending meetings, report gaps if relevant).
- Suggest clear next actions (e.g. "Resolve the 3 overdue tasks on X project", "Submit your report to unblock visibility", "Align with developer on Y blocker").
- Tone: professional, direct, supportive. No fluff.
- Plain text only, no markdown.`;

  const userMessage = `Current org snapshot (JSON):\n${JSON.stringify(context, null, 0)}`;

  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1024,
      temperature: 0.4
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as AlignmentOutput;
    return parsed;
  } catch {
    return null;
  }
}

export async function processAiAlignmentNotifications(prisma: PrismaClient, orgId: string): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: { orgId, type: NOTIFICATION_TYPE, channel: "in_app" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  if (recent && Date.now() - recent.createdAt.getTime() < THROTTLE_MS) return;

  const alignment = await generateAlignment(prisma, orgId);
  if (!alignment) return;

  const roleMap: (keyof AlignmentOutput)[] = ["sales", "developer", "director", "admin"];
  const roleKeyMap: Record<string, string[]> = {
    sales: [ROLE_KEYS.sales],
    developer: [ROLE_KEYS.developer],
    director: [ROLE_KEYS.director],
    admin: [ROLE_KEYS.admin]
  };

  for (const role of roleMap) {
    const msg = alignment[role];
    if (!msg?.subject || !msg?.body) continue;
    const keys = roleKeyMap[role];
    if (!keys?.length) continue;
    const userIds = await getUserIdByRoleKeys(prisma, orgId, keys);
    for (const userId of userIds) {
      await prisma.notification.create({
        data: {
          orgId,
          channel: "in_app",
          to: userId,
          subject: msg.subject.slice(0, 200),
          body: msg.body.slice(0, 2000),
          status: "sent",
          type: NOTIFICATION_TYPE,
          tier: role === "admin" ? "structural" : role === "director" ? "governance" : "execution"
        }
      });
    }
  }
  await logAdminActivity(prisma, {
    orgId,
    type: "ai_alignment_sent",
    summary: "AI alignment notifications sent to sales, developers, director, and admin.",
    body: "Role-specific suggestions on what's going on and how to align work to hit targets."
  });
}
