import type { PrismaClient } from "@prisma/client";
import { processDeveloperProgressRemindersForOrg } from "./developer-progress-reminders";

const ENABLED = process.env.DEVELOPER_PROGRESS_REMINDERS_ENABLED !== "false";
const INTERVAL_MS = Math.max(60_000, Number(process.env.DEVELOPER_PROGRESS_REMINDERS_INTERVAL_MS ?? 15 * 60_000));

/** Background sweep so nudges fire even when developers are not on the dashboard. */
export function scheduleDeveloperProgressReminders(prisma: PrismaClient): void {
  if (!ENABLED) {
    // eslint-disable-next-line no-console
    console.info("[reminders] Developer progress reminders disabled");
    return;
  }

  const tick = async () => {
    try {
      const orgs = await prisma.org.findMany({
        where: { deletedAt: null },
        select: { id: true }
      });
      for (const org of orgs) {
        await processDeveloperProgressRemindersForOrg(prisma, org.id);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[reminders] Developer progress sweep failed:", e);
    }
  };

  void tick();
  setInterval(() => void tick(), INTERVAL_MS);
  // eslint-disable-next-line no-console
  console.info(`[reminders] Developer progress reminders every ${INTERVAL_MS / 1000}s`);
}
