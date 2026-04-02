import type { PrismaClient } from "@prisma/client";
import { generateCallReminder, generateMeetingReminder } from "./ai-reminders";
import { logEmailSent } from "./admin-activity";
import { notifyAdminsInApp } from "./director-notifications";

const REMINDER_KEYS: Record<number, string> = {
  2880: "2d",
  1440: "1d",
  60: "1h",
  30: "30m",
  5: "5m",
  0: "0"
};

export async function processDueReminders(prisma: PrismaClient): Promise<void> {
  const now = Date.now();
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
  const followUps = await prisma.leadFollowUp.findMany({
    where: { scheduledAt: { gte: fiveMinutesAgo } }, // from 5 min ago so "0" reminder can fire
    include: {
      assignedTo: { select: { id: true, name: true, email: true, notificationEmail: true } },
      lead: { select: { id: true, title: true } }
    }
  });

  for (const fu of followUps) {
    const slots = (fu.reminderSlots as number[] | null) ?? [2880, 1440, 60, 30, 5];
    const scheduledMs = fu.scheduledAt.getTime();

    for (const minutesBefore of slots) {
      const key = REMINDER_KEYS[minutesBefore] ?? `${minutesBefore}m`;
      const triggerAt = scheduledMs - minutesBefore * 60 * 1000;
      if (now < triggerAt) continue; // not yet due

      const existing = await prisma.leadFollowUpReminder.findUnique({
        where: { followUpId_reminderKey: { followUpId: fu.id, reminderKey: key } }
      });
      if (existing) continue;

      const label = fu.type === "meeting" ? "Meeting" : "Call";
      const minutesUntil = Math.max(0, Math.round((scheduledMs - now) / (60 * 1000)));
      const fallbackTitle = `${label}: ${fu.lead.title}${fu.name ? ` (${fu.name})` : ""}`;
      const fallbackBody = `${label} in ${minutesBefore} minutes. Lead: ${fu.lead.title}. ${fu.business ? `Business: ${fu.business}. ` : ""}${fu.reason ? `Reason: ${fu.reason}. ` : ""}${fu.phone ? `Phone: ${fu.phone}` : ""}`;

      const context = {
        leadTitle: fu.lead.title,
        minutesUntil,
        name: fu.name,
        business: fu.business,
        reason: fu.reason,
        phone: fu.phone,
        scheduledAt: fu.scheduledAt
      };
      const aiCopy =
        fu.type === "meeting"
          ? await generateMeetingReminder(context)
          : await generateCallReminder(context);
      const title = aiCopy?.subject ?? fallbackTitle;
      const body = aiCopy?.body ?? fallbackBody;

      await prisma.$transaction([
        prisma.leadFollowUpReminder.create({
          data: { followUpId: fu.id, reminderKey: key }
        }),
        prisma.notification.create({
          data: {
            orgId: fu.orgId,
            channel: "in_app",
            to: fu.assignedToId,
            subject: title,
            body,
            status: "sent",
            type: "lead.follow_up_reminder",
            tier: "execution"
          }
        }),
        prisma.notification.create({
          data: {
            orgId: fu.orgId,
            channel: "email",
            to: fu.assignedTo?.notificationEmail ?? fu.assignedTo?.email ?? "",
            subject: `Reminder: ${title}`,
            body,
            status: "queued",
            type: "lead.follow_up_reminder",
            tier: "execution"
          }
        })
      ]);
      const toEmail = fu.assignedTo?.notificationEmail ?? fu.assignedTo?.email ?? "";
      if (toEmail) await logEmailSent(prisma, { orgId: fu.orgId, to: toEmail, subject: `Reminder: ${title}`, body, type: "lead.follow_up_reminder" });
      const salesLabel = fu.assignedTo?.name ?? fu.assignedTo?.email ?? "Sales";
      await notifyAdminsInApp(
        prisma,
        fu.orgId,
        `[Visibility] ${title}`,
        `Sales / assignee: ${salesLabel}. ${body}`,
        { type: "lead.follow_up_reminder.admin_mirror", tier: "structural", excludeUserIds: [fu.assignedToId] }
      );
    }
  }
}
