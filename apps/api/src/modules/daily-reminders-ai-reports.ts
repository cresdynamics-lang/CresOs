// @ts-nocheck
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ROLE_KEYS } from "./auth-middleware";
import { generateUserReminderEmail } from "./ai-reminders";
import { generateDirectorBriefingGroq } from "./director-ai-automation";
import { logEmailSent } from "./admin-activity";
import { notifyAdminsInApp, notifyDirectors } from "./director-notifications";
import { assertZonedTz, getUtcRangeForZonedDate, getZonedDateKey } from "./org-zoned-day";
import { listPlatformActionsForZonedDay } from "./director-platform-summary";

const TZ = process.env.DAILY_OPS_TZ?.trim() || "Africa/Nairobi";
const REMINDER_HOUR = Math.min(23, Math.max(0, Number(process.env.DAILY_OPS_REMINDER_HOUR ?? 18)));
/** Default 19:00 (7pm) org timezone — Director end-of-day briefing + AI digest. */
const AI_REPORT_HOUR = Math.min(23, Math.max(0, Number(process.env.DAILY_OPS_AI_REPORT_HOUR ?? 19)));
const ENABLED = process.env.DAILY_OPS_ENABLED !== "false";

function getZonedHourMinute(d: Date, tz: string): { hour: number; minute: number } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: assertZonedTz(tz),
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = f.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

async function ensureUserReminder(
  prisma: PrismaClient,
  orgId: string,
  user: { id: string; name: string | null; email: string; notificationEmail: string | null },
  dateKey: string,
  kind: string,
  fallbackSubject: string,
  fallbackBody: string
): Promise<void> {
  const { count: reserved } = await prisma.dailyReminderSent.createMany({
    data: [{ orgId, userId: user.id, dateKey, kind }],
    skipDuplicates: true
  });
  if (reserved === 0) return;

  const ai = await generateUserReminderEmail({
    reminderType: kind,
    title: fallbackSubject,
    context: fallbackBody,
    dueOrScheduled: `${TZ} ${dateKey} ${String(REMINDER_HOUR).padStart(2, "0")}:00`
  });

  const subject = ai?.subject?.trim() || fallbackSubject;
  const body = ai?.body?.trim() || fallbackBody;

  const email = (user.notificationEmail ?? user.email ?? "").trim();

  await prisma.notification.create({
    data: {
      orgId,
      channel: "in_app",
      to: user.id,
      subject,
      body,
      status: "sent",
      type: kind,
      tier: "execution"
    }
  });

  if (email) {
    const emailSubject = `Reminder: ${subject}`;
    await prisma.notification.create({
      data: {
        orgId,
        channel: "email",
        to: email,
        subject: emailSubject,
        body,
        status: "queued",
        type: kind,
        tier: "execution"
      }
    });
    await logEmailSent(prisma, { orgId, to: email, subject: emailSubject, body, type: kind });
  }
}

async function send6pmRemindersForOrg(
  prisma: PrismaClient,
  orgId: string,
  dateKey: string,
  range: { start: Date; end: Date }
): Promise<void> {
  const [salesRole, developerRole] = await Promise.all([
    prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.sales }, select: { id: true } }),
    prisma.role.findFirst({ where: { orgId, key: ROLE_KEYS.developer }, select: { id: true } })
  ]);

  const memberIds = new Set(
    (await prisma.orgMember.findMany({ where: { orgId }, select: { userId: true } })).map((m) => m.userId)
  );

  const [salesUserIds, developerUserIds] = await Promise.all([
    salesRole
      ? prisma.userRole
          .findMany({ where: { roleId: salesRole.id }, select: { userId: true } })
          .then((rows) => rows.map((r) => r.userId).filter((id) => memberIds.has(id)))
      : Promise.resolve([] as string[]),
    developerRole
      ? prisma.userRole
          .findMany({ where: { roleId: developerRole.id }, select: { userId: true } })
          .then((rows) => rows.map((r) => r.userId).filter((id) => memberIds.has(id)))
      : Promise.resolve([] as string[])
  ]);

  const [salesUsers, devUsers] = await Promise.all([
    salesUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: salesUserIds }, deletedAt: null },
          select: { id: true, name: true, email: true, notificationEmail: true }
        })
      : Promise.resolve([]),
    developerUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: developerUserIds }, deletedAt: null },
          select: { id: true, name: true, email: true, notificationEmail: true }
        })
      : Promise.resolve([])
  ]);

  for (const u of salesUsers) {
    const submitted = await prisma.salesReport.findFirst({
      where: {
        orgId,
        submittedById: u.id,
        status: "submitted",
        submittedAt: { gte: range.start, lt: range.end }
      },
      select: { id: true }
    });
    if (submitted) continue;

    await ensureUserReminder(
      prisma,
      orgId,
      u,
      dateKey,
      "sales_report_6pm",
      "Submit your sales report",
      `Please submit your sales report for ${dateKey} so leadership has a complete record.`
    );
  }

  for (const u of devUsers) {
    const submittedReport = await prisma.developerReport.findFirst({
      where: {
        orgId,
        submittedById: u.id,
        reportDate: { gte: range.start, lt: range.end }
      },
      select: { id: true }
    });

    if (!submittedReport) {
      await ensureUserReminder(
        prisma,
        orgId,
        u,
        dateKey,
        "developer_report_6pm",
        "Submit your developer report",
        `Please submit your developer daily report for ${dateKey} (what worked, blockers, needs attention, etc.).`
      );
    }

    await ensureUserReminder(
      prisma,
      orgId,
      u,
      dateKey,
      "developer_git_push_6pm",
      "Push your work and update CresOS",
      `Before end of day (${dateKey}), push your work (if applicable) and ensure your tasks/status are updated in CresOS.`
    );
  }
}

async function generateAiReportBody(prisma: PrismaClient, orgId: string, dateKey: string, range: { start: Date; end: Date }): Promise<string> {
  const [salesReports, devReports, projectsCreated, approvals, taskUpdates, logins] = await Promise.all([
    prisma.salesReport.count({ where: { orgId, status: "submitted", submittedAt: { gte: range.start, lt: range.end } } }),
    prisma.developerReport.count({ where: { orgId, reportDate: { gte: range.start, lt: range.end } } }),
    prisma.project.count({ where: { orgId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } } }),
    prisma.approval.count({ where: { orgId, createdAt: { gte: range.start, lt: range.end } } }),
    prisma.task.count({ where: { orgId, deletedAt: null, updatedAt: { gte: range.start, lt: range.end } } }),
    prisma.eventLog.count({ where: { orgId, type: "user.login", createdAt: { gte: range.start, lt: range.end } } })
  ]);

  const lines: string[] = [];
  lines.push(`AI Daily Summary (Africa/Nairobi) — ${dateKey}`);
  lines.push("");
  lines.push("Key activity counts:");
  lines.push(`- Sales reports submitted: ${salesReports}`);
  lines.push(`- Developer reports submitted: ${devReports}`);
  lines.push(`- Projects created/updated: ${projectsCreated}`);
  lines.push(`- Approvals created: ${approvals}`);
  lines.push(`- Tasks updated: ${taskUpdates}`);
  lines.push(`- User logins recorded: ${logins}`);
  lines.push("");
  lines.push("Notes:");
  lines.push("- This summary is generated automatically from CresOS records.");
  lines.push("- If counts look low, it may indicate missing updates or offline work not yet logged.");
  lines.push("");
  lines.push("Platform actions (admin activity + event log, newest first):");
  try {
    const actions = await listPlatformActionsForZonedDay(prisma, orgId, dateKey, TZ, {
      order: "desc",
      activityLimit: 80,
      eventLimit: 60,
      maxRows: 40
    });
    if (actions.length === 0) {
      lines.push("- (none in this day window)");
    } else {
      for (const a of actions) {
        const who = a.actorLabel ? ` — ${a.actorLabel}` : "";
        lines.push(`- ${a.source} / ${a.type}: ${a.summary}${who}`);
      }
    }
  } catch {
    lines.push("- (action log unavailable)");
  }

  return lines.join("\n");
}

async function run8pmAiReportForOrg(prisma: PrismaClient, orgId: string, orgName: string, dateKey: string, range: { start: Date; end: Date }): Promise<void> {
  const subject = `Director briefing: ${orgName} (${dateKey})`;

  try {
    const groqBody = await generateDirectorBriefingGroq(prisma, orgId, dateKey, range);
    const body = groqBody ?? generateAiReportBody(prisma, orgId, dateKey, range);
    const created = await prisma.adminAiReport.create({
      data: {
        orgId,
        dateKey,
        subject,
        body
      }
    });

    await notifyDirectors(
      prisma,
      orgId,
      subject,
      `${body}\n\nReport ID: ${created.id}`,
      { type: "admin_ai_report.generated" }
    );

    await notifyAdminsInApp(
      prisma,
      orgId,
      `[AI Report] ${subject}`,
      `${body.slice(0, 1200)}${body.length > 1200 ? "…" : ""}\n\nOpen: Reports → AI Reports`,
      { type: "admin_ai_report.generated", tier: "structural" }
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return;
    }
    throw e;
  }
}

/**
 * Runs once per process; checks every minute for 18:00 and 20:00 Africa/Nairobi.
 */
export function scheduleDailyOps(prisma: PrismaClient): void {
  if (!ENABLED) {
    // eslint-disable-next-line no-console
    console.info("[daily-ops] Daily ops scheduler disabled (DAILY_OPS_ENABLED=false)");
    return;
  }

  let lastTickKey = "";

  const tick = async () => {
    try {
      const now = new Date();
      const dateKey = getZonedDateKey(now, TZ);
      const { hour, minute } = getZonedHourMinute(now, TZ);
      if (minute !== 0) return;

      const orgs = await prisma.org.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
      });

      if (hour === REMINDER_HOUR) {
        const tickKey = `${dateKey}T${hour}:${minute}:reminders`;
        if (tickKey === lastTickKey) return;
        lastTickKey = tickKey;

        const range = await getUtcRangeForZonedDate(prisma, dateKey, TZ);
        for (const org of orgs) {
          await send6pmRemindersForOrg(prisma, org.id, dateKey, range);
        }
        return;
      }

      if (hour === AI_REPORT_HOUR) {
        const tickKey = `${dateKey}T${hour}:${minute}:ai`;
        if (tickKey === lastTickKey) return;
        lastTickKey = tickKey;

        const range = await getUtcRangeForZonedDate(prisma, dateKey, TZ);
        for (const org of orgs) {
          await run8pmAiReportForOrg(prisma, org.id, org.name, dateKey, range);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[daily-ops] failed:", e);
    }
  };

  void tick();
  setInterval(() => void tick(), 60_000);
  // eslint-disable-next-line no-console
  console.info(`[daily-ops] Scheduled (${TZ}, reminders ${REMINDER_HOUR}:00, ai ${AI_REPORT_HOUR}:00)`);
}
