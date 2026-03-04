import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { PERMISSIONS } from "./permissions-registry";

export default function adminRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Structural health snapshot for Admin
  router.get(
    "/dashboard",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const sevenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );

      const [
        conflicts,
        overrideCount,
        approvalBypassAttempts,
        failedLogins,
        permissionChanges,
        dataCorrections
      ] = await Promise.all([
        prisma.conflictLog.count({
          where: { orgId, createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.overrideAction.count({
          where: { orgId, createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.adminAlert.count({
          where: {
            orgId,
            type: "approval_bypass_attempt",
            createdAt: { gte: sevenDaysAgo }
          }
        }),
        prisma.adminAlert.count({
          where: {
            orgId,
            type: "failed_login",
            createdAt: { gte: sevenDaysAgo }
          }
        }),
        prisma.eventLog.count({
          where: {
            orgId,
            type: "admin.permissions.updated",
            createdAt: { gte: sevenDaysAgo }
          }
        }),
        prisma.adminAlert.count({
          where: {
            orgId,
            type: "data_correction",
            createdAt: { gte: sevenDaysAgo }
          }
        })
      ]);

      res.json({
        roleConflictsLast7d: conflicts,
        overrideActionsLast7d: overrideCount,
        approvalBypassAttemptsLast7d: approvalBypassAttempts,
        failedLoginAlertsLast7d: failedLogins,
        permissionChangesLast7d: permissionChanges,
        dataCorrectionAlertsLast7d: dataCorrections
      });
    }
  );

  // Roles and role assignments
  router.get(
    "/roles",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const roles = await prisma.role.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" }
      });
      res.json(roles);
    }
  );

  router.get(
    "/roles/:roleId/users",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { roleId } = req.params;
      const assignments = await prisma.userRole.findMany({
        where: {
          roleId
        },
        include: {
          user: true,
          role: true
        }
      });
      const filtered = assignments.filter(
        (a) => a.role.orgId === orgId
      );
      res.json(filtered);
    }
  );

  router.post(
    "/role-assignments",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { userId, roleId } = req.body as {
        userId: string;
        roleId: string;
      };

      if (!userId || !roleId) {
        res.status(400).json({ error: "userId and roleId are required" });
        return;
      }

      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.orgId !== orgId) {
        res.status(404).json({ error: "Role not found" });
        return;
      }

      // Prevent obvious conflicts like Director + Finance without explicit override flow
      const existingRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: true }
      });

      const existingKeys = new Set(existingRoles.map((r) => r.role.key));
      const isDirector = role.key === ROLE_KEYS.director || existingKeys.has(ROLE_KEYS.director);
      const isFinance = role.key === ROLE_KEYS.finance || existingKeys.has(ROLE_KEYS.finance);

      if (isDirector && isFinance) {
        await prisma.conflictLog.create({
          data: {
            orgId,
            userId,
            type: "role_conflict_director_finance",
            context: { roleId, existingRoles: Array.from(existingKeys) }
          }
        });
        res.status(400).json({ error: "Cannot assign conflicting roles Director and Finance to same user" });
        return;
      }

      const assignment = await prisma.userRole.create({
        data: {
          userId,
          roleId
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.role_assigned",
          entityType: "user",
          entityId: userId,
          metadata: { roleId }
        }
      });

      res.status(201).json(assignment);
    }
  );

  // Permission matrix
  router.get(
    "/permissions/matrix",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const [roles, permissions, rolePermissions] = await Promise.all([
        prisma.role.findMany({ where: { orgId } }),
        prisma.permission.findMany(),
        prisma.rolePermission.findMany({ where: { orgId } })
      ]);

      res.json({
        roles,
        permissions,
        rolePermissions
      });
    }
  );

  // Seed permissions for this deployment (idempotent)
  router.post(
    "/permissions/seed",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      await Promise.all(
        PERMISSIONS.map((p) =>
          prisma.permission.upsert({
            where: { key: p.key },
            update: { description: p.description },
            create: { key: p.key, description: p.description }
          })
        )
      );
      res.status(204).send();
    }
  );

  router.post(
    "/roles/:roleId/permissions",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { roleId } = req.params;
      const { permissionKeys } = req.body as {
        permissionKeys: string[];
      };

      if (!permissionKeys || !permissionKeys.length) {
        res.status(400).json({ error: "permissionKeys is required" });
        return;
      }

      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.orgId !== orgId) {
        res.status(404).json({ error: "Role not found" });
        return;
      }

      const permissions = await prisma.permission.findMany({
        where: { key: { in: permissionKeys } }
      });

      const previous = await prisma.rolePermission.findMany({
        where: { orgId, roleId }
      });

      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({
          where: { orgId, roleId }
        });

        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            orgId,
            roleId,
            permissionId: p.id
          }))
        });

        await tx.eventLog.create({
          data: {
            orgId,
            actorId: adminId,
            type: "admin.permissions.updated",
            entityType: "role",
            entityId: roleId,
            metadata: {
              previous: previous.map((rp) => rp.permissionId),
              next: permissions.map((p) => p.id)
            }
          }
        });
      });

      res.status(204).send();
    }
  );

  // Conflicts
  router.get(
    "/conflicts",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { userId } = req.query as { userId?: string };

      const where: Prisma.ConflictLogWhereInput = { orgId };
      if (userId) where.userId = userId;

      const conflicts = await prisma.conflictLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200
      });

      res.json(conflicts);
    }
  );

  // Sessions & account state
  router.get(
    "/sessions",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { userId } = req.query as { userId?: string };

      const where: Prisma.SessionWhereInput = { orgId, revokedAt: null };
      if (userId) where.userId = userId;

      const sessions = await prisma.session.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200
      });

      res.json(sessions);
    }
  );

  router.post(
    "/sessions/:id/revoke",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const session = await prisma.session.findUnique({ where: { id } });
      if (!session || session.orgId !== orgId) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      await prisma.session.update({
        where: { id },
        data: { revokedAt: new Date() }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.session.revoked",
          entityType: "session",
          entityId: id
        }
      });

      res.status(204).send();
    }
  );

  // User account status management
  router.post(
    "/users/:id/lock",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: { status: "locked" }
      });

      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await prisma.eventLog.create({
        data: {
          orgId: user.orgId!,
          actorId: adminId,
          type: "admin.user.locked",
          entityType: "user",
          entityId: id
        }
      });

      res.json(user);
    }
  );

  router.post(
    "/users/:id/suspend",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: { status: "suspended" }
      });

      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await prisma.eventLog.create({
        data: {
          orgId: user.orgId!,
          actorId: adminId,
          type: "admin.user.suspended",
          entityType: "user",
          entityId: id
        }
      });

      res.json(user);
    }
  );

  router.post(
    "/users/:id/reactivate",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: { status: "active" }
      });

      await prisma.eventLog.create({
        data: {
          orgId: user.orgId!,
          actorId: adminId,
          type: "admin.user.reactivated",
          entityType: "user",
          entityId: id
        }
      });

      res.json(user);
    }
  );

  // Thresholds (Admin view of DirectorConfig)
  router.get(
    "/thresholds",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const config = await prisma.directorConfig.findUnique({
        where: { orgId }
      });
      res.json(config?.thresholds ?? {});
    }
  );

  // Security configuration (password policy, token expiry)
  router.get(
    "/security-config",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const config = await prisma.securityConfig.findUnique({
        where: { orgId }
      });
      res.json(config);
    }
  );

  router.post(
    "/security-config",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const {
        passwordMinLength,
        requireMixedCase,
        requireNumbers,
        tokenExpiryMinutes,
        mfaRequired
      } = req.body as {
        passwordMinLength?: number;
        requireMixedCase?: boolean;
        requireNumbers?: boolean;
        tokenExpiryMinutes?: number;
        mfaRequired?: boolean;
      };

      const existing = await prisma.securityConfig.findUnique({
        where: { orgId }
      });

      const updated = await prisma.securityConfig.upsert({
        where: { orgId },
        create: {
          orgId,
          passwordMinLength: passwordMinLength ?? 8,
          requireMixedCase: requireMixedCase ?? false,
          requireNumbers: requireNumbers ?? false,
          tokenExpiryMinutes: tokenExpiryMinutes ?? 60,
          mfaRequired: mfaRequired ?? false
        },
        update: {
          passwordMinLength:
            passwordMinLength ?? existing?.passwordMinLength ?? 8,
          requireMixedCase:
            requireMixedCase ?? existing?.requireMixedCase ?? false,
          requireNumbers:
            requireNumbers ?? existing?.requireNumbers ?? false,
          tokenExpiryMinutes:
            tokenExpiryMinutes ?? existing?.tokenExpiryMinutes ?? 60,
          mfaRequired: mfaRequired ?? existing?.mfaRequired ?? false
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.security_config.updated",
          entityType: "security_config",
          entityId: updated.id,
          metadata: { previous: existing, next: updated }
        }
      });

      res.json(updated);
    }
  );

  router.post(
    "/thresholds",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { thresholds, reason } = req.body as {
        thresholds: Record<string, unknown>;
        reason?: string;
      };

      if (!thresholds) {
        res.status(400).json({ error: "thresholds is required" });
        return;
      }

      const existing = await prisma.directorConfig.findUnique({
        where: { orgId }
      });

      const updated = await prisma.directorConfig.upsert({
        where: { orgId },
        create: {
          orgId,
          thresholds
        },
        update: {
          thresholds
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.thresholds.updated",
          entityType: "director_config",
          entityId: updated.id,
          metadata: { previous: existing?.thresholds, next: thresholds, reason }
        }
      });

      // Notify Director(s) via governance alert would be wired here

      res.json(updated);
    }
  );

  // Generic restore override for soft-deleted entities
  router.post(
    "/overrides/:entityType/:id/restore",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { entityType, id } = req.params;
      const { reason } = req.body as { reason: string };

      if (!reason) {
        res.status(400).json({ error: "reason is required" });
        return;
      }

      const supported: Array<
        "project" | "task" | "milestone" | "invoice" | "expense" | "payout" | "deal" | "lead" | "client"
      > = [
        "project",
        "task",
        "milestone",
        "invoice",
        "expense",
        "payout",
        "deal",
        "lead",
        "client"
      ];

      if (!supported.includes(entityType as any)) {
        res.status(400).json({ error: "Unsupported entityType for restore" });
        return;
      }

      const model = (prisma as any)[entityType] as {
        findFirst: (args: any) => Promise<any>;
        update: (args: any) => Promise<any>;
      };

      const existing = await model.findFirst({
        where: { id, orgId }
      });

      if (!existing || !existing.deletedAt) {
        res.status(404).json({ error: "Soft-deleted record not found" });
        return;
      }

      const restored = await model.update({
        where: { id },
        data: { deletedAt: null }
      });

      await prisma.overrideAction.create({
        data: {
          orgId,
          adminUserId: adminId,
          overrideType: "restore",
          entityType,
          entityId: id,
          reason,
          metadata: { previousDeletedAt: existing.deletedAt }
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.override.restore",
          entityType,
          entityId: id,
          metadata: { reason }
        }
      });

      await prisma.adminAlert.create({
        data: {
          orgId,
          type: "data_correction",
          severity: "warning",
          details: { entityType, entityId: id, reason }
        }
      });

      res.json(restored);
    }
  );

  // Audit log read-only access
  router.get(
    "/audit",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { entityType, entityId, userId, limit = "200" } = req.query as {
        entityType?: string;
        entityId?: string;
        userId?: string;
        limit?: string;
      };
      const take = Math.min(parseInt(limit, 10) || 200, 1000);

      const where: Prisma.EventLogWhereInput = { orgId };
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (userId) where.actorId = userId;

      const events = await prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take
      });

      res.json(events);
    }
  );

  // Governance reports
  router.get(
    "/reports/roles",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const users = await prisma.user.findMany({
        where: { orgId },
        include: {
          roles: {
            include: { role: true }
          }
        }
      });

      const report = users.map((u) => ({
        userId: u.id,
        email: u.email,
        roles: u.roles.map((r) => r.role.key)
      }));

      res.json(report);
    }
  );

  router.get(
    "/reports/conflicts",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const conflicts = await prisma.conflictLog.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 1000
      });
      res.json(conflicts);
    }
  );

  router.get(
    "/reports/overrides",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const overrides = await prisma.overrideAction.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 1000
      });
      res.json(overrides);
    }
  );

  router.get(
    "/reports/access-activity",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const [sessions, failedLoginAlerts] = await Promise.all([
        prisma.session.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          take: 1000
        }),
        prisma.adminAlert.findMany({
          where: { orgId, type: "failed_login" },
          orderBy: { createdAt: "desc" },
          take: 1000
        })
      ]);

      res.json({
        sessions,
        failedLoginAlerts
      });
    }
  );

  // Performance overview: roles, activity, finance, responsibilities
  router.get(
    "/performance",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const [rolesWithUsers, recentEvents, payments, expenses, projectsByStatus, roleList] = await Promise.all([
        prisma.role.findMany({
          where: { orgId },
          include: { users: { select: { userId: true } } }
        }),
        prisma.eventLog.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          take: 50
        }),
        prisma.payment.findMany({
          where: { orgId, deletedAt: null, status: "confirmed" },
          select: { amount: true }
        }),
        prisma.expense.findMany({
          where: { orgId, deletedAt: null },
          select: { amount: true }
        }),
        prisma.project.groupBy({
          by: ["status"],
          where: { orgId, deletedAt: null },
          _count: true
        }),
        prisma.role.findMany({
          where: { orgId },
          select: { id: true, key: true, name: true }
        })
      ]);

      const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
      const expenditure = expenses.reduce((s, e) => s + Number(e.amount), 0);

      const rolePerformance = rolesWithUsers.map((r) => ({
        roleKey: r.key,
        roleName: r.name,
        userCount: r.users.length
      }));

      const responsibilities: Record<string, string> = {
        admin: "Full access: users, org, security, performance, finance overview",
        director_admin: "Approve leads & projects, comment, view all projects and reports",
        sales: "Create leads & projects, submit reports, manage CRM contacts",
        developer: "Delivery: tasks, milestones; assigned as developer on approved projects",
        finance: "View approved projects (contact & price), update contact/price; invoices & payments",
        analyst: "View projects, leads, reports; analytics"
      };

      res.json({
        rolePerformance,
        recentActivity: recentEvents,
        finance: { revenue, expenditure },
        projectCountByStatus: Object.fromEntries(projectsByStatus.map((p) => [p.status, p._count])),
        responsibilities: roleList.map((r) => ({ roleKey: r.key, roleName: r.name, description: responsibilities[r.key] ?? r.name }))
      });
    }
  );

  // Users list with profile details (for admin to view/edit)
  router.get(
    "/users",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const users = await prisma.user.findMany({
        where: { orgId, deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          notificationEmail: true,
          profileCompletedAt: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      });
      res.json(users);
    }
  );

  router.patch(
    "/users/:id",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const body = req.body as { name?: string; phone?: string; notificationEmail?: string | null };
      const user = await prisma.user.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!user) return res.status(404).json({ error: "User not found" });
      const data: { name?: string; phone?: string; notificationEmail?: string | null } = {};
      if (body.name !== undefined) data.name = body.name?.trim() || null;
      if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
      if (body.notificationEmail !== undefined) data.notificationEmail = body.notificationEmail?.trim() || null;
      const updated = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          notificationEmail: true,
          profileCompletedAt: true,
          status: true
        }
      });
      res.json(updated);
    }
  );

  // Alerts
  router.get(
    "/alerts",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { status, severity } = req.query as {
        status?: string;
        severity?: string;
      };

      const where: Prisma.AdminAlertWhereInput = { orgId };
      if (status) where.status = status;
      if (severity) where.severity = severity;

      const alerts = await prisma.adminAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200
      });

      res.json(alerts);
    }
  );

  router.post(
    "/alerts/:id/acknowledge",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;

      const alert = await prisma.adminAlert.findUnique({ where: { id } });
      if (!alert || alert.orgId !== orgId) {
        res.status(404).json({ error: "Alert not found" });
        return;
      }

      const updated = await prisma.adminAlert.update({
        where: { id },
        data: { status: "acknowledged" }
      });

      res.json(updated);
    }
  );

  return router;
}

