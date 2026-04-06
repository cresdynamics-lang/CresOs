// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { PERMISSIONS } from "./permissions-registry";
import { sendWelcomeEmail } from "../lib/resend";
import { logEmailSent } from "./admin-activity";
import { notifyAdminsInApp } from "./director-notifications";
import { processFinanceApprovalEscalations } from "./finance-approval-escalation";

const OVERSIGHT_24H_MS = 24 * 60 * 60 * 1000;

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

  // Finance submissions: only admin can approve (expense, payout). Director can view only.
  router.post(
    "/finance-approvals/:id/decision",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const { id } = req.params;
      const { status, note } = req.body as {
        status: "approved" | "rejected" | "cancelled";
        note?: string;
      };

      if (!status) {
        res.status(400).json({ error: "Missing status" });
        return;
      }
      if (status === "rejected" && (!note || !String(note).trim())) {
        res.status(400).json({
          error: "A written explanation is required when declining a finance request (what is missing, which rule, or what must change)."
        });
        return;
      }

      const existing = await prisma.approval.findUnique({ where: { id } });
      if (!existing || existing.orgId !== orgId) {
        res.status(404).json({ error: "Approval not found" });
        return;
      }
      if (existing.entityType !== "expense" && existing.entityType !== "payout") {
        res.status(400).json({ error: "This endpoint is only for expense or payout approvals" });
        return;
      }
      if (existing.status !== "pending") {
        res.status(400).json({ error: "Approval is not pending" });
        return;
      }

      const approval = await prisma.approval.update({
        where: { id },
        data: {
          status,
          approverId: userId,
          decisionNote: note,
          decidedAt: new Date()
        }
      });

      if (status === "approved") {
        if (existing.entityType === "expense") {
          await prisma.expense.updateMany({
            where: { id: existing.entityId, orgId },
            data: { status: "approved" }
          });
        } else if (existing.entityType === "payout") {
          await prisma.payout.updateMany({
            where: { id: existing.entityId, orgId, deletedAt: null },
            data: { paidAt: new Date() }
          });
        }
      } else if (status === "rejected" || status === "cancelled") {
        if (existing.entityType === "expense") {
          await prisma.expense.updateMany({
            where: { id: existing.entityId, orgId },
            data: { status: "rejected" }
          });
        } else if (existing.entityType === "payout") {
          await prisma.payout.updateMany({
            where: { id: existing.entityId, orgId },
            data: { deletedAt: new Date() }
          });
        }
      }

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: userId,
          type: `approval.${status}`,
          entityType: approval.entityType,
          entityId: approval.entityId,
          metadata: {
            approvalId: approval.id,
            approver: "admin",
            decisionNote: note ?? null
          }
        }
      });

      res.json(approval);
    }
  );

  // Departments CRUD
  router.get(
    "/departments",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const list = await prisma.department.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" },
        include: { 
          _count: { select: { roles: true, members: true } },
          roles: {
            select: {
              id: true,
              name: true,
              key: true,
              _count: { select: { users: true } }
            }
          }
        }
      });
      
      // Ensure standard departments exist
      const standardDepartments = ['Sales', 'Development', 'Finance', 'Marketing', 'Operations', 'HR'];
      const existingDeptNames = list.map(d => d.name);
      
      // Create missing standard departments
      for (const deptName of standardDepartments) {
        if (!existingDeptNames.includes(deptName)) {
          await prisma.department.create({
            data: {
              orgId,
              name: deptName,
              description: `Standard ${deptName} department`
            }
          });
        }
      }
      
      // Fetch updated list
      const updatedList = await prisma.department.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" },
        include: { 
          _count: { select: { roles: true, members: true } },
          roles: {
            select: {
              id: true,
              name: true,
              key: true,
              _count: { select: { users: true } }
            }
          }
        }
      });
      
      res.json(updatedList);
    }
  );

  router.post(
    "/departments",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { name, description } = req.body as { name?: string; description?: string };
      if (!name?.trim()) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      
      // Check if department already exists
      const existing = await prisma.department.findFirst({
        where: { orgId, name: name.trim(), deletedAt: null }
      });
      
      if (existing) {
        res.status(400).json({ error: "Department with this name already exists" });
        return;
      }
      
      const dept = await prisma.department.create({
        data: { 
          orgId, 
          name: name.trim(), 
          description: description?.trim() || null 
        }
      });
      
      res.status(201).json(dept);
    }
  );

  router.patch(
    "/departments/:id",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { name, description } = req.body as { name?: string; description?: string };
      const existing = await prisma.department.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!existing) {
        res.status(404).json({ error: "Department not found" });
        return;
      }
      const data: { name?: string; description?: string | null } = {};
      if (name !== undefined) data.name = name.trim() || existing.name;
      if (description !== undefined) data.description = description?.trim() || null;
      const updated = await prisma.department.update({
        where: { id },
        data
      });
      res.json(updated);
    }
  );

  router.delete(
    "/departments/:id",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const existing = await prisma.department.findFirst({
        where: { id, orgId, deletedAt: null },
        include: { _count: { select: { roles: true, members: true } } }
      });
      if (!existing) {
        res.status(404).json({ error: "Department not found" });
        return;
      }
      if (existing._count.roles > 0 || existing._count.members > 0) {
        res.status(400).json({ error: "Department has roles or members; move or delete them first" });
        return;
      }
      await prisma.department.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
      res.status(204).send();
    }
  );

  // Assign user to department
  router.post(
    "/departments/:id/users",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { userId } = req.body as { userId?: string };
      
      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }
      
      const department = await prisma.department.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      
      if (!department) {
        res.status(404).json({ error: "Department not found" });
        return;
      }
      
      const user = await prisma.user.findFirst({
        where: { id: userId, orgId, deletedAt: null }
      });
      
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      // Check if user is already a member
      const existingMembership = await prisma.orgMember.findFirst({
        where: { userId, departmentId: id }
      });
      
      if (existingMembership) {
        res.status(400).json({ error: "User is already a member of this department" });
        return;
      }
      
      const membership = await prisma.orgMember.create({
        data: { orgId, userId, departmentId: id }
      });
      
      res.status(201).json(membership);
    }
  );

  // Remove user from department
  router.delete(
    "/departments/:id/users/:userId",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id, userId } = req.params;
      
      const department = await prisma.department.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      
      if (!department) {
        res.status(404).json({ error: "Department not found" });
        return;
      }
      
      await prisma.orgMember.deleteMany({
        where: { userId, departmentId: id }
      });
      
      res.status(204).send();
    }
  );

  // Get department members
  router.get(
    "/departments/:id/users",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      
      const department = await prisma.department.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      
      if (!department) {
        res.status(404).json({ error: "Department not found" });
        return;
      }
      
      const members = await prisma.orgMember.findMany({
        where: { departmentId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              createdAt: true,
              roles: {
                select: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                      key: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      res.json(members);
    }
  );

  // Roles CRUD
  router.get(
    "/roles",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const roles = await prisma.role.findMany({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        include: { department: { select: { id: true, name: true } } }
      });
      res.json(roles);
    }
  );

  router.post(
    "/roles",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { name, key, departmentId } = req.body as { name?: string; key?: string; departmentId?: string | null };
      if (!name?.trim() || !key?.trim()) {
        res.status(400).json({ error: "name and key are required" });
        return;
      }
      const keyNorm = key.trim().toLowerCase().replace(/\s+/g, "_");
      const existing = await prisma.role.findUnique({
        where: { orgId_key: { orgId, key: keyNorm } }
      });
      if (existing) {
        res.status(400).json({ error: "Role with this key already exists" });
        return;
      }
      if (departmentId) {
        const dept = await prisma.department.findFirst({
          where: { id: departmentId, orgId, deletedAt: null }
        });
        if (!dept) {
          res.status(400).json({ error: "Department not found" });
          return;
        }
      }
      const role = await prisma.role.create({
        data: {
          orgId,
          name: name.trim(),
          key: keyNorm,
          departmentId: departmentId?.trim() || null
        }
      });
      res.status(201).json(role);
    }
  );

  router.patch(
    "/roles/:id",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const { name, key, departmentId } = req.body as { name?: string; key?: string; departmentId?: string | null };
      const role = await prisma.role.findFirst({
        where: { id, orgId }
      });
      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      const data: { name?: string; key?: string; departmentId?: string | null } = {};
      if (name !== undefined) data.name = name.trim();
      if (key !== undefined) data.key = key.trim().toLowerCase().replace(/\s+/g, "_");
      if (departmentId !== undefined) data.departmentId = departmentId?.trim() || null;
      if (data.departmentId) {
        const dept = await prisma.department.findFirst({
          where: { id: data.departmentId, orgId, deletedAt: null }
        });
        if (!dept) {
          res.status(400).json({ error: "Department not found" });
          return;
        }
      }
      const updated = await prisma.role.update({
        where: { id },
        data
      });
      res.json(updated);
    }
  );

  router.delete(
    "/roles/:id",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { id } = req.params;
      const role = await prisma.role.findFirst({
        where: { id, orgId },
        include: { _count: { select: { users: true } } }
      });
      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      if (role._count.users > 0) {
        res.status(400).json({ error: "Role has users assigned; remove assignments first" });
        return;
      }
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await prisma.role.delete({ where: { id } });
      res.status(204).send();
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

  router.delete(
    "/role-assignments",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const { userId, roleId } = req.body as { userId?: string; roleId?: string };
      if (!userId || !roleId) {
        res.status(400).json({ error: "userId and roleId are required" });
        return;
      }
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.orgId !== orgId) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      const user = await prisma.user.findFirst({
        where: { id: userId, orgId, deletedAt: null }
      });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      await prisma.userRole.deleteMany({
        where: { userId, roleId }
      });
      res.status(204).send();
    }
  );

  // Create user (admin): email, name, temporary password, roleId
  router.post(
    "/users",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { email, name, password, roleId } = req.body as {
        email?: string;
        name?: string;
        password?: string;
        roleId?: string;
      };
      if (!email?.trim() || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
      }
      const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existing) {
        res.status(400).json({ error: "Email already in use" });
        return;
      }
      const role = roleId
        ? await prisma.role.findFirst({ where: { id: roleId, orgId } })
        : null;
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email: email.trim().toLowerCase(),
          name: name?.trim() || null,
          passwordHash,
          orgId
        }
      });
      if (role) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id }
        });
        await prisma.orgMember.create({
          data: { orgId, userId: user.id, roleId: role.id }
        });
      } else {
        await prisma.orgMember.create({
          data: { orgId, userId: user.id }
        });
      }
      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.user.created",
          entityType: "user",
          entityId: user.id,
          metadata: { email: user.email }
        }
      });

      await notifyAdminsInApp(
        prisma,
        orgId,
        "[Visibility] User created",
        `An admin created a new user: ${user.email}`,
        { type: "admin.user.created", tier: "structural", excludeUserIds: [adminId] }
      );
      res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status
      });
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
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const existing = await prisma.user.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!existing) {
        res.status(404).json({ error: "User not found" });
        return;
      }

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
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const existing = await prisma.user.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!existing) {
        res.status(404).json({ error: "User not found" });
        return;
      }

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
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;

      const existing = await prisma.user.findFirst({ where: { id, orgId, deletedAt: null } });
      if (!existing) {
        res.status(404).json({ error: "User not found" });
        return;
      }

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

  // Admin activity messages: all things happening (meeting requests, emails sent, etc.) for admin to stay on track
  router.get(
    "/messages",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 500);
      const messages = await prisma.adminActivityMessage.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          actor: { select: { id: true, name: true, email: true } }
        }
      });
      res.json(messages);
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
          createdAt: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                  key: true,
                  department: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          memberships: {
            select: {
              department: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      
      // Transform users data to include department information
      const usersWithDepartments = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        notificationEmail: user.notificationEmail,
        profileCompletedAt: user.profileCompletedAt,
        status: user.status,
        createdAt: user.createdAt,
        roles: user.roles.map(r => ({
          id: r.role.id,
          name: r.role.name,
          key: r.role.key,
          department: r.role.department
        })),
        departments: [
          ...user.roles.map(r => r.role.department).filter(Boolean),
          ...user.memberships.map(m => m.department).filter(Boolean)
        ].reduce((unique, dept) => {
          if (dept && !unique.find(d => d.id === dept.id)) {
            unique.push(dept);
          }
          return unique;
        }, [] as Array<{ id: string; name: string }>)
      }));
      
      res.json(usersWithDepartments);
    }
  );

  router.patch(
    "/users/:id",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;
      const body = req.body as { name?: string; phone?: string; notificationEmail?: string | null };
      const user = await prisma.user.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!user) return res.status(404).json({ error: "User not found" });
      const data: { name?: string; phone?: string; notificationEmail?: string | null; profileCompletedAt?: Date } = {};
      if (body.name !== undefined) data.name = body.name?.trim() || null;
      if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
      if (body.notificationEmail !== undefined) data.notificationEmail = body.notificationEmail?.trim() || null;
      // Mark profile as completed once admin fills core contact fields
      if (data.name !== undefined || data.phone !== undefined || data.notificationEmail !== undefined) {
        data.profileCompletedAt = new Date();
      }
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

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.user.updated",
          entityType: "user",
          entityId: id,
          metadata: {
            fields: Object.keys(data)
          }
        }
      });

      await notifyAdminsInApp(
        prisma,
        orgId,
        "[Visibility] User updated",
        `An admin updated a user's profile details: ${updated.email}`,
        { type: "admin.user.updated", tier: "structural", excludeUserIds: [adminId] }
      );

      // Send a confirmation email when profile/contact details are updated by admin
      const toEmail = updated.notificationEmail?.trim() || updated.email;
      if (toEmail) {
        try {
          const result = await sendWelcomeEmail(toEmail, updated.name);
          if (result.ok) {
            const bodyText =
              "Your CresOS profile details have been updated. We will use this email for notifications and alignment messages.";
            await logEmailSent(prisma, {
              orgId,
              to: toEmail,
              subject: "Your CresOS profile was updated",
              body: bodyText,
              type: "profile_updated_admin",
              actorId: adminId
            });
          }
        } catch {
          // ignore email failures so admin can still save
        }
      }

      res.json(updated);
    }
  );

  // Admin password reset: set a temporary password for a user
  router.post(
    "/users/:id/reset-password",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const adminId = req.auth!.userId;
      const { id } = req.params;
      const { temporaryPassword } = req.body as { temporaryPassword?: string };

      if (!temporaryPassword || temporaryPassword.length < 8) {
        res.status(400).json({ error: "temporaryPassword is required and must be at least 8 characters" });
        return;
      }

      const user = await prisma.user.findFirst({
        where: { id, orgId, deletedAt: null }
      });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordLastChangedAt: new Date()
        }
      });

      await prisma.eventLog.create({
        data: {
          orgId,
          actorId: adminId,
          type: "admin.user.password_reset",
          entityType: "user",
          entityId: id,
          metadata: {}
        }
      });

      await notifyAdminsInApp(
        prisma,
        orgId,
        "[Visibility] User password reset",
        "An admin reset a user's password.",
        { type: "admin.user.password_reset", tier: "structural", excludeUserIds: [adminId] }
      );

      res.status(204).send();
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

  // Operational oversight: finance queue, delays, handoffs (read-only data for Admin UI)
  router.get(
    "/oversight",
    requireRoles([ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const now = new Date();
      const cutoff24 = new Date(Date.now() - OVERSIGHT_24H_MS);

      void processFinanceApprovalEscalations(prisma, orgId).catch(() => {});

      const [
        financePendingCount,
        financeOver24h,
        delayedProjects,
        pendingHandoffs,
        tasksOverdueCount
      ] = await Promise.all([
        prisma.approval.count({
          where: { orgId, status: "pending", entityType: { in: ["expense", "payout"] } }
        }),
        prisma.approval.findMany({
          where: {
            orgId,
            status: "pending",
            entityType: { in: ["expense", "payout"] },
            createdAt: { lt: cutoff24 }
          },
          orderBy: { createdAt: "asc" },
          take: 50,
          include: { requester: { select: { id: true, name: true, email: true } } }
        }),
        prisma.project.findMany({
          where: {
            orgId,
            deletedAt: null,
            OR: [
              { endDate: { lt: now }, status: { in: ["planned", "active"] } },
              { status: "paused" }
            ]
          },
          take: 40,
          select: {
            id: true,
            name: true,
            status: true,
            endDate: true,
            approvalStatus: true,
            assignedDeveloperId: true,
            updatedAt: true
          }
        }),
        prisma.projectHandoffRequest.count({ where: { orgId, status: "pending" } }),
        prisma.task.count({
          where: {
            orgId,
            deletedAt: null,
            status: { not: "done" },
            dueDate: { lt: now }
          }
        })
      ]);

      res.json({
        financePendingCount,
        financeOver24h: financeOver24h.map((a) => ({
          id: a.id,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt,
          reason: a.reason,
          hoursPending: Math.floor((Date.now() - a.createdAt.getTime()) / (60 * 60 * 1000)),
          requester: a.requester
        })),
        delayedProjects,
        pendingHandoffs,
        tasksOverdueCount
      });
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

