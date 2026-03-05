import type { PrismaClient } from "@prisma/client";
import { logEmailSent } from "./admin-activity";

/**
 * Process schedule item reminders: for items with reminderMinutesBefore set,
 * when the reminder time has passed, send in-app (and email) notification so
 * the user can prepare for the meeting/call/report, then mark reminder as sent.
 * Runs when dashboard /attention is fetched (and other reminder jobs run).
 */
export async function processScheduleReminders(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const items = await prisma.scheduleItem.findMany({
    where: {
      reminderMinutesBefore: { not: null },
      reminderSentAt: null,
      completedAt: null,
      scheduledAt: { gt: now } // only future items — reminder fires X min before
    },
    include: {
      user: { select: { id: true, email: true, notificationEmail: true } }
    }
  });

  for (const item of items) {
    const minutesBefore = item.reminderMinutesBefore!;
    const triggerAt = new Date(item.scheduledAt.getTime() - minutesBefore * 60 * 1000);
    if (now < triggerAt) continue;

    const typeLabel =
      item.type === "meeting"
        ? "Meeting"
        : item.type === "call"
          ? "Call"
          : item.type === "report"
            ? "Report"
            : item.type === "task"
              ? "Task"
              : "Item";
    const minsLeft = Math.max(0, Math.round((item.scheduledAt.getTime() - now.getTime()) / (60 * 1000)));
    const subject = `Get ready: ${item.title}`;
    const body =
      minsLeft > 0
        ? `${typeLabel} "${item.title}" is in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}.${item.notes ? ` ${item.notes}` : ""}`
        : `${typeLabel} "${item.title}" is starting now.${item.notes ? ` ${item.notes}` : ""}`;

    const userEmail = item.user.notificationEmail ?? item.user.email ?? "";

    await prisma.scheduleItem.update({
      where: { id: item.id },
      data: { reminderSentAt: now }
    });
    await prisma.notification.create({
      data: {
        orgId: item.orgId,
        channel: "in_app",
        to: item.userId,
        subject,
        body,
        status: "sent",
        type: "schedule_reminder",
        tier: "execution"
      }
    });
    if (userEmail) {
      const emailSubject = `Reminder: ${subject}`;
      await prisma.notification.create({
        data: {
          orgId: item.orgId,
          channel: "email",
          to: userEmail,
          subject: emailSubject,
          body,
          status: "queued",
          type: "schedule_reminder",
          tier: "execution"
        }
      });
      await logEmailSent(prisma, { orgId: item.orgId, to: userEmail, subject: emailSubject, body, type: "schedule_reminder" });
    }
  }

  // Mark missed meetings/calls and raise alerts if needed
  const graceMinutes = 15;
  const missedCutoff = new Date(now.getTime() - graceMinutes * 60 * 1000);
  const missedCandidates = await prisma.scheduleItem.findMany({
    where: {
      completedAt: null,
      scheduledAt: { lt: missedCutoff },
      type: { in: ["meeting", "call"] },
      status: { in: ["scheduled", "rescheduled"] }
    },
    include: {
      user: { select: { id: true, name: true, email: true, notificationEmail: true } }
    }
  });

  for (const item of missedCandidates) {
    await prisma.scheduleItem.update({
      where: { id: item.id },
      data: { status: "missed" }
    });

    const typeLabel = item.type === "meeting" ? "Meeting" : "Call";
    const subject = `${typeLabel} missed: ${item.title}`;
    const body = `${typeLabel} "${item.title}" scheduled for ${item.scheduledAt.toISOString()} was not marked attended. Please update as attended or reschedule if this is incorrect.`;

    // Notify the owner
    await prisma.notification.create({
      data: {
        orgId: item.orgId,
        channel: "in_app",
        to: item.userId,
        subject,
        body,
        status: "sent",
        type: "schedule_missed",
        tier: "execution"
      }
    });
  }
}
