// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

const REMINDER_MINUTES_OPTIONS = [5, 15, 30, 60, 120] as const;

function parseReminderMinutes(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  if (n === 0) return null;
  return REMINDER_MINUTES_OPTIONS.includes(n as (typeof REMINDER_MINUTES_OPTIONS)[number]) ? n : null;
}

type Period = "day" | "week" | "month" | "quarter";

function getRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);

  switch (period) {
    case "day":
      end.setDate(end.getDate() + 1);
      end.setMilliseconds(-1);
      break;
    case "week":
      const dayOfWeek = start.getDay();
      const monday = new Date(start);
      monday.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      start.setTime(monday.getTime());
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
      end.setMilliseconds(-1);
      break;
    case "month":
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case "quarter":
      const q = Math.floor(now.getMonth() / 3) + 1;
      start.setMonth((q - 1) * 3);
      start.setDate(1);
      end.setMonth(q * 3);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      end.setDate(end.getDate() + 1);
      end.setMilliseconds(-1);
  }
  return { start, end };
}

export default function scheduleRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // List my schedule items with optional period and completed filter; returns stats for accountability review
  router.get(
    "/",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const period = (req.query.period as Period) || "week";
      const completedFilter = (req.query.completed as string) || "all"; // all | done | pending

      const { start, end } = getRange(period);

      const where = {
        orgId,
        userId,
        scheduledAt: { gte: start, lte: end }
      };

      const items = await prisma.scheduleItem.findMany({
        where,
        orderBy: { scheduledAt: "asc" }
      });

      const filtered =
        completedFilter === "done"
          ? items.filter((i) => i.completedAt != null)
          : completedFilter === "pending"
            ? items.filter((i) => i.completedAt == null)
            : items;

      const completed = items.filter((i) => i.completedAt != null).length;
      const pending = items.length - completed;

      res.json({
        period,
        range: { start: start.toISOString(), end: end.toISOString() },
        stats: { total: items.length, completed, pending },
        items: filtered
      });
    }
  );

  // Create schedule item
  router.post(
    "/",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const body = req.body as { title: string; type?: string; scheduledAt: string; notes?: string; reminderMinutesBefore?: number | null };
      if (!body.title?.trim()) {
        res.status(400).json({ error: "Title is required" });
        return;
      }
      const scheduledAt = new Date(body.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        res.status(400).json({ error: "Valid scheduledAt is required" });
        return;
      }
      const type = ["meeting", "call", "report", "task", "other"].includes(body.type || "")
        ? body.type!
        : "task";
      const reminderMinutesBefore = parseReminderMinutes(body.reminderMinutesBefore);
      const item = await prisma.scheduleItem.create({
        data: {
          orgId,
          userId,
          title: body.title.trim(),
          type,
          scheduledAt,
          originalScheduledAt: scheduledAt,
          status: "scheduled",
          notes: body.notes?.trim() || null,
          reminderMinutesBefore,
          reminderSentAt: null
        }
      });
      res.status(201).json(item);
    }
  );

  // Update schedule item. Sales/developer may only mark done/undo; admin/director/analyst may also edit fields.
  router.patch(
    "/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.developer, ROLE_KEYS.director, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const roleKeys = req.auth!.roleKeys;
      const canEditHistory = roleKeys.some((r) => [ROLE_KEYS.admin, ROLE_KEYS.director].includes(r));
      const { id } = req.params;
      const body = req.body as { title?: string; type?: string; scheduledAt?: string; notes?: string; completed?: boolean; reminderMinutesBefore?: number | null };
      const existing = await prisma.scheduleItem.findFirst({
        where: { id, orgId, userId }
      });
      if (!existing) {
        res.status(404).json({ error: "Schedule item not found" });
        return;
      }
      const data: {
        title?: string;
        type?: string;
        scheduledAt?: Date;
        originalScheduledAt?: Date | null;
        status?: string;
        notes?: string | null;
        completedAt?: Date | null;
        reminderMinutesBefore?: number | null;
        reminderSentAt?: Date | null;
      } = {};
      if (body.completed !== undefined) {
        data.completedAt = body.completed ? new Date() : null;
        if (body.completed) data.status = "completed";
      }
      if (canEditHistory) {
        if (body.title !== undefined) data.title = body.title.trim();
        if (body.type !== undefined && ["meeting", "call", "report", "task", "other"].includes(body.type)) data.type = body.type;
        if (body.scheduledAt !== undefined) {
          const d = new Date(body.scheduledAt);
          if (!isNaN(d.getTime())) {
            data.scheduledAt = d;
            if (!existing.originalScheduledAt) {
              data.originalScheduledAt = existing.scheduledAt;
            }
            if (!existing.completedAt) {
              data.status = "rescheduled";
            }
          }
        }
        if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
        if (body.reminderMinutesBefore !== undefined) {
          data.reminderMinutesBefore = parseReminderMinutes(body.reminderMinutesBefore);
          if (data.reminderMinutesBefore !== existing.reminderMinutesBefore) data.reminderSentAt = null;
        }
      }

      const updated = await prisma.scheduleItem.update({
        where: { id },
        data
      });
      res.json(updated);
    }
  );

  // Delete schedule item — only admin/director may delete (sales/developer cannot tamper with history)
  router.delete(
    "/:id",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director, ROLE_KEYS.sales, ROLE_KEYS.developer, ROLE_KEYS.analyst]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const roleKeys = req.auth!.roleKeys;
      const canDelete = roleKeys.some((r) => [ROLE_KEYS.admin, ROLE_KEYS.director].includes(r));
      if (!canDelete) {
        res.status(403).json({ error: "You cannot delete schedule items" });
        return;
      }
      const { id } = req.params;
      const existing = await prisma.scheduleItem.findFirst({
        where: { id, orgId, userId }
      });
      if (!existing) {
        res.status(404).json({ error: "Schedule item not found" });
        return;
      }
      await prisma.scheduleItem.delete({ where: { id } });
      res.status(204).send();
    }
  );

  return router;
}
