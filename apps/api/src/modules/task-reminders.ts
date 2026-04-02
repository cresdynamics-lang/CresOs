import type { PrismaClient } from "@prisma/client";
import { generateTaskReminder } from "./ai-reminders";
import { logEmailSent } from "./admin-activity";
import { notifyAdminsInApp } from "./director-notifications";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function processTaskDueReminders(prisma: PrismaClient): Promise<void> {
  const now = Date.now();
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      dueDate: { not: null },
      assigneeId: { not: null },
      status: { not: "done" }
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, notificationEmail: true } },
      project: { select: { id: true, name: true } }
    }
  });

  for (const task of tasks) {
    const due = task.dueDate!.getTime();
    const assignee = task.assignee!;
    const email = assignee.notificationEmail ?? assignee.email ?? "";

    // Overdue: due date has passed
    if (now > due) {
      const existing = await prisma.taskDueReminder.findUnique({
        where: { taskId_reminderKey: { taskId: task.id, reminderKey: "overdue" } }
      });
      if (!existing) {
        const fallbackSubject = `Task overdue: ${task.title}`;
        const fallbackBody = `Task "${task.title}" (${task.project.name}) was due and is now overdue.`;
        const aiCopy = await generateTaskReminder({
          taskTitle: task.title,
          projectName: task.project.name,
          dueIn: "overdue",
          dueDate: task.dueDate!
        });
        const subject = aiCopy?.subject ?? fallbackSubject;
        const body = aiCopy?.body ?? fallbackBody;
        await prisma.$transaction([
          prisma.taskDueReminder.create({
            data: { taskId: task.id, reminderKey: "overdue" }
          }),
          prisma.notification.create({
            data: {
              orgId: task.orgId,
              channel: "in_app",
              to: assignee.id,
              subject,
              body,
              status: "sent",
              type: "task_due_reminder",
              tier: "execution"
            }
          }),
          prisma.notification.create({
            data: {
              orgId: task.orgId,
              channel: "email",
              to: email,
              subject: `Reminder: ${subject}`,
              body,
              status: "queued",
              type: "task_due_reminder",
              tier: "execution"
            }
          })
        ]);
        await logEmailSent(prisma, { orgId: task.orgId, to: email, subject: `Reminder: ${subject}`, body, type: "task_due_reminder" });
        const assigneeLabel = assignee.name ?? assignee.email ?? "Assignee";
        await notifyAdminsInApp(
          prisma,
          task.orgId,
          `[Visibility] ${subject}`,
          `Developer / assignee: ${assigneeLabel}. ${body}`,
          { type: "task_due_reminder.admin_mirror", tier: "structural", excludeUserIds: [assignee.id] }
        );
      }
      continue;
    }

    const msUntilDue = due - now;

    // 1 day before
    if (msUntilDue <= ONE_DAY_MS && msUntilDue > ONE_HOUR_MS) {
      const existing = await prisma.taskDueReminder.findUnique({
        where: { taskId_reminderKey: { taskId: task.id, reminderKey: "1d" } }
      });
      if (!existing) {
        const fallbackSubject = `Task due in 1 day: ${task.title}`;
        const fallbackBody = `Task "${task.title}" (${task.project.name}) is due in 1 day.`;
        const aiCopy = await generateTaskReminder({
          taskTitle: task.title,
          projectName: task.project.name,
          dueIn: "1d",
          dueDate: task.dueDate!
        });
        const subject = aiCopy?.subject ?? fallbackSubject;
        const body = aiCopy?.body ?? fallbackBody;
        await prisma.$transaction([
          prisma.taskDueReminder.create({
            data: { taskId: task.id, reminderKey: "1d" }
          }),
          prisma.notification.create({
            data: {
              orgId: task.orgId,
              channel: "in_app",
              to: assignee.id,
              subject,
              body,
              status: "sent",
              type: "task_due_reminder",
              tier: "execution"
            }
          }),
          prisma.notification.create({
            data: {
              orgId: task.orgId,
              channel: "email",
              to: email,
              subject: `Reminder: ${subject}`,
              body,
              status: "queued",
              type: "task_due_reminder",
              tier: "execution"
            }
          })
        ]);
        await logEmailSent(prisma, { orgId: task.orgId, to: email, subject: `Reminder: ${subject}`, body, type: "task_due_reminder" });
        const assigneeLabel = assignee.name ?? assignee.email ?? "Assignee";
        await notifyAdminsInApp(
          prisma,
          task.orgId,
          `[Visibility] ${subject}`,
          `Developer / assignee: ${assigneeLabel}. ${body}`,
          { type: "task_due_reminder.admin_mirror", tier: "structural", excludeUserIds: [assignee.id] }
        );
      }
      continue;
    }

    // 1 hour before
    if (msUntilDue <= ONE_HOUR_MS) {
      const existing = await prisma.taskDueReminder.findUnique({
        where: { taskId_reminderKey: { taskId: task.id, reminderKey: "1h" } }
      });
      if (!existing) {
        const fallbackSubject = `Task due in 1 hour: ${task.title}`;
        const fallbackBody = `Task "${task.title}" (${task.project.name}) is due in 1 hour.`;
        const aiCopy = await generateTaskReminder({
          taskTitle: task.title,
          projectName: task.project.name,
          dueIn: "1h",
          dueDate: task.dueDate!
        });
        const subject = aiCopy?.subject ?? fallbackSubject;
        const body = aiCopy?.body ?? fallbackBody;
        await prisma.$transaction([
          prisma.taskDueReminder.create({
            data: { taskId: task.id, reminderKey: "1h" }
          }),
          prisma.notification.create({
            data: {
              orgId: task.orgId,
              channel: "in_app",
              to: assignee.id,
              subject,
              body,
              status: "sent",
              type: "task_due_reminder",
              tier: "execution"
            }
          }),
          prisma.notification.create({
            data: {
              orgId: task.orgId,
              channel: "email",
              to: email,
              subject: `Reminder: ${subject}`,
              body,
              status: "queued",
              type: "task_due_reminder",
              tier: "execution"
            }
          })
        ]);
        await logEmailSent(prisma, { orgId: task.orgId, to: email, subject: `Reminder: ${subject}`, body, type: "task_due_reminder" });
        const assigneeLabel = assignee.name ?? assignee.email ?? "Assignee";
        await notifyAdminsInApp(
          prisma,
          task.orgId,
          `[Visibility] ${subject}`,
          `Developer / assignee: ${assigneeLabel}. ${body}`,
          { type: "task_due_reminder.admin_mirror", tier: "structural", excludeUserIds: [assignee.id] }
        );
      }
    }
  }
}
