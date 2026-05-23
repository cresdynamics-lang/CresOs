import type { PrismaClient } from "@prisma/client";
import { enrichPlatformEventSummaries } from "../lib/platform-event-summary";
import { DEFAULT_ORG_DAY_TZ, getUtcRangeForZonedDate } from "./org-zoned-day";

const EVENT_EXCLUDE_TYPES = new Set(["user.login"]);

export type PlatformActionRow = {
  id: string;
  source: "activity" | "event";
  createdAt: string;
  type: string;
  summary: string;
  detail: string | null;
  actorLabel: string | null;
};

/**
 * Admin activity feed + (non-login) event log for one org calendar day in `tz`.
 * Used by the director panel and by the nightly Groq briefing payload.
 */
export async function listPlatformActionsForZonedDay(
  prisma: PrismaClient,
  orgId: string,
  dateKey: string,
  tz: string = DEFAULT_ORG_DAY_TZ,
  options?: { order?: "asc" | "desc"; activityLimit?: number; eventLimit?: number; maxRows?: number }
): Promise<PlatformActionRow[]> {
  const { start, end } = await getUtcRangeForZonedDate(prisma, dateKey, tz);
  const order = options?.order ?? "desc";
  const activityLimit = options?.activityLimit ?? 220;
  const eventLimit = options?.eventLimit ?? 150;
  const maxRows = options?.maxRows ?? 280;

  const [activities, events] = await Promise.all([
    prisma.adminActivityMessage.findMany({
      where: { orgId, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      take: activityLimit,
      include: { actor: { select: { name: true, email: true } } }
    }),
    prisma.eventLog.findMany({
      where: {
        orgId,
        createdAt: { gte: start, lt: end },
        type: { notIn: Array.from(EVENT_EXCLUDE_TYPES) }
      },
      orderBy: { createdAt: "asc" },
      take: eventLimit,
      select: {
        id: true,
        type: true,
        entityType: true,
        entityId: true,
        actorId: true,
        metadata: true,
        createdAt: true
      }
    })
  ]);

  const eventEnriched = await enrichPlatformEventSummaries(prisma, events);

  const activityRows: PlatformActionRow[] = activities.map((a) => ({
    id: `a:${a.id}`,
    source: "activity",
    createdAt: a.createdAt.toISOString(),
    type: a.type,
    summary: a.summary,
    detail: a.body,
    actorLabel: a.actor ? (a.actor.name?.trim() || a.actor.email) : null
  }));

  const eventRows: PlatformActionRow[] = events.map((ev) => {
    const rich = eventEnriched.get(ev.id);
    return {
      id: `e:${ev.id}`,
      source: "event",
      createdAt: ev.createdAt.toISOString(),
      type: ev.type,
      summary: rich?.summary ?? `${ev.type} · ${ev.entityType}`,
      detail: null,
      actorLabel: rich?.actorLabel ?? null
    };
  });

  const merged = [...activityRows, ...eventRows].sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
  );
  if (order === "desc") merged.reverse();
  return merged.slice(0, maxRows);
}
