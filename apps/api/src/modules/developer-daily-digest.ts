import type { PrismaClient } from "@prisma/client";
import { notifyDirectors } from "./director-notifications";
import { ROLE_KEYS } from "./auth-middleware";

const DIGEST_TZ = process.env.DEVELOPER_DAILY_DIGEST_TZ?.trim() || "Africa/Nairobi";
const DIGEST_HOUR = Math.min(23, Math.max(0, Number(process.env.DEVELOPER_DAILY_DIGEST_HOUR ?? 18)));
const ENABLED = process.env.DEVELOPER_DAILY_DIGEST_ENABLED !== "false";

function assertDateKey(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid dateKey");
  return s;
}

function assertTz(s: string): string {
  if (!/^[A-Za-z0-9/_+-]+$/.test(s)) throw new Error("Invalid timezone");
  return s;
}

function getZonedDateKey(d: Date, tz: string): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: assertTz(tz), year: "numeric", month: "2-digit", day: "2-digit" });
  return assertDateKey(f.format(d));
}

function getZonedHourMinute(d: Date, tz: string): { hour: number; minute: number } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: assertTz(tz),
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = f.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

function addCalendarDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return assertDateKey(dt.toISOString().slice(0, 10));
}

async function getUtcRangeForZonedDate(prisma: PrismaClient, dateKey: string, tz: string): Promise<{ start: Date; end: Date }> {
  const dk = assertDateKey(dateKey);
  const t = assertTz(tz);
  const next = addCalendarDay(dk);
  const rows = await prisma.$queryRawUnsafe<Array<{ start: Date; end: Date }>>(
    `SELECT (timestamp '${dk} 00:00:00' AT TIME ZONE '${t}') AS start, (timestamp '${next} 00:00:00' AT TIME ZONE '${t}') AS end`
  );
  if (!rows?.[0]) throw new Error("digest day range query failed");
  return { start: rows[0].start, end: rows[0].end };
}

async function runDigestForDeveloper(
  prisma: PrismaClient,
  orgId: string,
  orgName: string,
  developerId: string,
  developerName: string,
  dateKey: string,
  range: { start: Date; end: Date }
): Promise<void> {
  const { count: reserved } = await prisma.developerDailyDigestSent.createMany({
    data: [{ orgId, userId: developerId, dateKey }],
    skipDuplicates: true
  });
  if (reserved === 0) return;

  const user = await prisma.user.findUnique({
    where: { id: developerId },
    select: {
      currentFocusNote: true,
      currentFocusUpdatedAt: true,
      currentFocusProject: { select: { id: true, name: true } }
    }
  });

  const taskUpdates = await prisma.task.findMany({
    where: {
      orgId,
      deletedAt: null,
      project: {
        deletedAt: null,
        OR: [
          { assignedDeveloperId: developerId },
          {
            developerAssignments: {
              some: { userId: developerId, status: "accepted" }
            }
          }
        ]
      },
      updatedAt: { gte: range.start, lt: range.end }
    },
    include: { project: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 40
  });

  const commentsToday = await prisma.taskComment.findMany({
    where: {
      orgId,
      deletedAt: null,
      authorId: developerId,
      createdAt: { gte: range.start, lt: range.end }
    },
    include: {
      task: { select: { title: true, project: { select: { name: true } } } }
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  const manualReport = await prisma.developerReport.findFirst({
    where: {
      orgId,
      submittedById: developerId,
      reportDate: { gte: range.start, lt: range.end }
    },
    orderBy: { createdAt: "desc" }
  });

  const lines: string[] = [];
  lines.push(`Organization: ${orgName}`);
  lines.push(`Developer: ${developerName}`);
  lines.push(`Date (${DIGEST_TZ}): ${dateKey}`);
  lines.push("");
  lines.push("This is an automatic end-of-day summary from CresOS (tasks, notes, and comments recorded on the platform).");
  lines.push("");

  if (user?.currentFocusProject || user?.currentFocusNote) {
    lines.push("Current focus (from profile):");
    if (user.currentFocusProject) {
      lines.push(`  Project: ${user.currentFocusProject.name}`);
    }
    const note = user.currentFocusNote?.trim();
    if (note) {
      lines.push(`  Note: ${note.slice(0, 2000)}${note.length > 2000 ? "…" : ""}`);
    }
    if (user.currentFocusUpdatedAt) {
      lines.push(`  Updated: ${user.currentFocusUpdatedAt.toISOString()}`);
    }
    lines.push("");
  }

  if (manualReport) {
    lines.push("Manual developer report submitted today: yes (compare with platform activity below).");
    lines.push(`  Report id: ${manualReport.id}`);
    lines.push("");
  } else {
    lines.push("Manual developer report submitted today: not found for this calendar day.");
    lines.push("");
  }

  if (taskUpdates.length === 0 && commentsToday.length === 0) {
    lines.push("Platform activity today: no task updates or task comments recorded for assigned projects.");
  } else {
    if (taskUpdates.length > 0) {
      lines.push(`Tasks touched today (${taskUpdates.length}):`);
      for (const t of taskUpdates) {
        lines.push(
          `  • [${t.status}] ${t.title} — project "${t.project.name}" (updated ${t.updatedAt.toISOString()})`
        );
        if (t.blockedReason?.trim()) {
          lines.push(`    Blocker: ${t.blockedReason.trim().slice(0, 500)}`);
        }
      }
      lines.push("");
    }
    if (commentsToday.length > 0) {
      lines.push(`Task comments added today (${commentsToday.length}):`);
      for (const c of commentsToday) {
        const proj = c.task.project?.name ?? "?";
        lines.push(`  • [${c.type}] on "${c.task.title}" (${proj}): ${c.body.trim().slice(0, 400)}${c.body.length > 400 ? "…" : ""}`);
      }
    }
  }

  const body = lines.join("\n");

  try {
    await notifyDirectors(prisma, orgId, `EOD platform digest — ${developerName} (${dateKey})`, body, {
      type: "developer.daily_digest"
    });
  } catch (e) {
    await prisma.developerDailyDigestSent
      .delete({ where: { orgId_userId_dateKey: { orgId, userId: developerId, dateKey } } })
      .catch(() => {});
    throw e;
  }
}

/**
 * Runs once per process; checks every minute for the configured local hour and sends one digest per developer per day.
 */
export function scheduleDeveloperDailyDigest(prisma: PrismaClient): void {
  if (!ENABLED) {
    // eslint-disable-next-line no-console
    console.info("[digest] Developer daily digest scheduler disabled (DEVELOPER_DAILY_DIGEST_ENABLED=false)");
    return;
  }

  let lastTickKey = "";

  const tick = async () => {
    try {
      const now = new Date();
      const dateKey = getZonedDateKey(now, DIGEST_TZ);
      const { hour, minute } = getZonedHourMinute(now, DIGEST_TZ);
      if (hour !== DIGEST_HOUR || minute !== 0) return;

      const tickKey = `${dateKey}T${hour}:${minute}`;
      if (tickKey === lastTickKey) return;
      lastTickKey = tickKey;

      const range = await getUtcRangeForZonedDate(prisma, dateKey, DIGEST_TZ);

      const orgs = await prisma.org.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
      });

      for (const org of orgs) {
        const developerRole = await prisma.role.findFirst({
          where: { orgId: org.id, key: ROLE_KEYS.developer }
        });
        if (!developerRole) continue;

        const memberIds = new Set(
          (await prisma.orgMember.findMany({ where: { orgId: org.id }, select: { userId: true } })).map((m) => m.userId)
        );
        const devUserIds = (
          await prisma.userRole.findMany({
            where: { roleId: developerRole.id },
            select: { userId: true }
          })
        )
          .map((r) => r.userId)
          .filter((id) => memberIds.has(id));

        const users = await prisma.user.findMany({
          where: { id: { in: devUserIds }, deletedAt: null },
          select: { id: true, name: true, email: true }
        });

        for (const u of users) {
          const name = u.name?.trim() || u.email;
          await runDigestForDeveloper(prisma, org.id, org.name, u.id, name, dateKey, range);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[digest] Developer daily digest failed:", e);
    }
  };

  void tick();
  setInterval(() => void tick(), 60_000);
  // eslint-disable-next-line no-console
  console.info(`[digest] Developer daily digest scheduled (${DIGEST_TZ}, hour ${DIGEST_HOUR}:00)`);
}
