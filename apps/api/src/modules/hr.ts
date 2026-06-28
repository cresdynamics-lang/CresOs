import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";
import {
  assertNoDirectorFinanceConflict,
  HR_EMPLOYEE_ROLE_KEYS,
  HR_MANAGEABLE_ROLE_KEYS,
  isHrStaffRole,
  listHrEmployees,
  resolveReportsToDirectorId
} from "../lib/hr-employment";

const HR_ACCESS = [ROLE_KEYS.hr, ROLE_KEYS.admin];

export default function hrRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get("/meta", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const [roles, departments, leaders] = await Promise.all([
      prisma.role.findMany({
        where: { orgId, key: { in: [...HR_MANAGEABLE_ROLE_KEYS] } },
        include: { department: { select: { id: true, name: true } } },
        orderBy: { name: "asc" }
      }),
      prisma.department.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" }
      }),
      prisma.user.findMany({
        where: {
          orgId,
          deletedAt: null,
          roles: { some: { role: { key: { in: [ROLE_KEYS.director, ROLE_KEYS.admin] } } } }
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" }
      })
    ]);
    res.json({ roles, departments, leaders });
  });

  router.get("/employees", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const employees = await listHrEmployees(prisma, orgId);
    res.json(employees);
  });

  router.get("/employees/:id", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const id = req.params.id as string;
    const employees = await listHrEmployees(prisma, orgId);
    const employee = employees.find((e) => e.id === id);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json(employee);
  });

  router.get("/analytics", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const employees = await listHrEmployees(prisma, orgId);

    const salaryExpenses = await prisma.expense.findMany({
      where: { orgId, deletedAt: null, category: "salaries" },
      orderBy: { spentAt: "desc" },
      take: 200
    });

    const monthlyPayrollTotal = employees.reduce((sum, e) => sum + (e.monthlySalary ?? 0), 0);

    res.json({
      employees,
      monthlyPayrollTotal,
      salaryExpenses: salaryExpenses.map((x) => ({
        amount: Number(x.amount),
        status: x.status,
        spentAt: x.spentAt.toISOString()
      })),
      scheduleKpis: null
    });
  });

  router.post("/users", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const actorId = req.auth!.userId;
    const body = req.body as {
      email?: string;
      name?: string;
      password?: string;
      roleId?: string;
      reportsToDirectorId?: string | null;
      jobTitle?: string | null;
      employmentType?: string | null;
      hireDate?: string | null;
      monthlySalary?: number | string | null;
      phone?: string | null;
    };

    if (!body.email?.trim() || !body.password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    if (body.password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const emailNorm = body.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: emailNorm, deletedAt: null }
    });
    if (existing) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const role = body.roleId
      ? await prisma.role.findFirst({ where: { id: body.roleId, orgId } })
      : null;
    if (body.roleId && !role) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (role && !isHrStaffRole(role.key)) {
      res.status(400).json({ error: "HR cannot assign the client role" });
      return;
    }

    let directorId: string | null = null;
    if (body.reportsToDirectorId) {
      const resolved = await resolveReportsToDirectorId(prisma, orgId, body.reportsToDirectorId);
      if ("error" in resolved) {
        res.status(400).json({ error: resolved.error });
        return;
      }
      directorId = resolved.value;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        name: body.name?.trim() || null,
        phone: body.phone?.trim() || null,
        passwordHash,
        orgId,
        phoneNumbers: [],
        workEmails: [],
        reportsToDirectorId: directorId,
        jobTitle: body.jobTitle?.trim() || null,
        employmentType: body.employmentType?.trim() || "full_time",
        hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
        monthlySalary:
          body.monthlySalary != null && body.monthlySalary !== ""
            ? new Prisma.Decimal(String(body.monthlySalary))
            : null
      }
    });

    if (role) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId, userId: user.id } },
        create: { orgId, userId: user.id, roleId: role.id },
        update: { roleId: role.id }
      });
    } else {
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId, userId: user.id } },
        create: { orgId, userId: user.id },
        update: {}
      });
    }

    await logAdminActivity(prisma, {
      orgId,
      type: "hr.user.created",
      summary: `HR created employee: ${user.email}`,
      actorId,
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email, roleKey: role?.key ?? null }
    });

    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  });

  router.patch("/employees/:id", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const id = req.params.id as string;
    const body = req.body as {
      name?: string | null;
      phone?: string | null;
      notificationEmail?: string | null;
      reportsToDirectorId?: string | null;
      jobTitle?: string | null;
      employmentType?: string | null;
      hireDate?: string | null;
      monthlySalary?: number | string | null;
    };

    const user = await prisma.user.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { roles: { include: { role: true } } }
    });
    if (!user || !user.roles.some((r) => HR_EMPLOYEE_ROLE_KEYS.includes(r.role.key))) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const data: Prisma.UserUpdateInput = {};
    if (body.name !== undefined) data.name = body.name?.trim() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.notificationEmail !== undefined) {
      data.notificationEmail = body.notificationEmail?.trim() || null;
    }
    if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle?.trim() || null;
    if (body.employmentType !== undefined) {
      data.employmentType = body.employmentType?.trim() || "full_time";
    }
    if (body.hireDate !== undefined) {
      data.hireDate = body.hireDate ? new Date(body.hireDate) : null;
    }
    if (body.monthlySalary !== undefined) {
      data.monthlySalary =
        body.monthlySalary != null && body.monthlySalary !== ""
          ? new Prisma.Decimal(String(body.monthlySalary))
          : null;
    }
    if (body.reportsToDirectorId !== undefined) {
      const resolved = await resolveReportsToDirectorId(prisma, orgId, body.reportsToDirectorId, id);
      if ("error" in resolved) {
        res.status(400).json({ error: resolved.error });
        return;
      }
      data.reportsToDirector = resolved.value
        ? { connect: { id: resolved.value } }
        : { disconnect: true };
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    await prisma.user.update({ where: { id }, data });
    const employees = await listHrEmployees(prisma, orgId);
    res.json(employees.find((e) => e.id === id));
  });

  router.post("/employees/:id/roles", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.params.id as string;
    const { roleId } = req.body as { roleId?: string };
    if (!roleId) {
      res.status(400).json({ error: "roleId is required" });
      return;
    }

    const role = await prisma.role.findFirst({ where: { id: roleId, orgId } });
    if (!role || !isHrStaffRole(role.key)) {
      res.status(400).json({ error: "Invalid role for HR assignment" });
      return;
    }

    const user = await prisma.user.findFirst({ where: { id: userId, orgId, deletedAt: null } });
    if (!user) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const conflict = await assertNoDirectorFinanceConflict(prisma, userId, role.key);
    if (conflict) {
      res.status(400).json({ error: conflict });
      return;
    }

    const existing = await prisma.userRole.findFirst({ where: { userId, roleId } });
    if (!existing) {
      await prisma.userRole.create({ data: { userId, roleId } });
    }
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, roleId },
      update: { roleId }
    });

    res.json({ ok: true });
  });

  router.delete("/employees/:userId/roles/:roleId", requireRoles(HR_ACCESS), async (req, res) => {
    const userId = req.params.userId as string;
    const roleId = req.params.roleId as string;
    await prisma.userRole.deleteMany({ where: { userId, roleId } });
    res.status(204).send();
  });

  router.get("/payroll", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const employees = await listHrEmployees(prisma, orgId);

    const salaryExpenses = await prisma.expense.findMany({
      where: { orgId, deletedAt: null, category: "salaries" },
      orderBy: { spentAt: "desc" },
      take: 100,
      include: {
        beneficiary: { select: { id: true, name: true, email: true } }
      }
    });

    const payouts = await prisma.payout.findMany({
      where: {
        orgId,
        deletedAt: null,
        recipientId: { in: employees.map((e) => e.id) }
      },
      orderBy: { paidAt: "desc" },
      take: 100,
      include: {
        recipient: { select: { id: true, name: true, email: true } }
      }
    });

    const monthlyPayrollTotal = employees.reduce((sum, e) => sum + (e.monthlySalary ?? 0), 0);

    res.json({
      monthlyPayrollTotal,
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        monthlySalary: e.monthlySalary,
        roles: e.roles.map((r) => r.key)
      })),
      salaryExpenses: salaryExpenses.map((x) => ({
        id: x.id,
        amount: Number(x.amount),
        currency: x.currency,
        status: x.status,
        spentAt: x.spentAt.toISOString(),
        description: x.description,
        beneficiary: x.beneficiary
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        paidAt: p.paidAt?.toISOString() ?? null,
        scheduledAt: p.scheduledAt?.toISOString() ?? null,
        description: p.description,
        recipient: p.recipient
      }))
    });
  });

  router.post("/payroll/record", requireRoles(HR_ACCESS), async (req, res) => {
    const orgId = req.auth!.orgId;
    const actorId = req.auth!.userId;
    const body = req.body as {
      beneficiaryUserId?: string;
      amount?: string | number;
      currency?: string;
      spentAt?: string;
      description?: string;
      notes?: string;
      transactionCode?: string;
      account?: string;
    };

    if (!body.beneficiaryUserId || body.amount == null || !body.spentAt) {
      res.status(400).json({ error: "beneficiaryUserId, amount, and spentAt are required" });
      return;
    }

    const beneficiary = await prisma.user.findFirst({
      where: { id: body.beneficiaryUserId, orgId, deletedAt: null }
    });
    if (!beneficiary) {
      res.status(400).json({ error: "Employee not found" });
      return;
    }

    const expense = await prisma.expense.create({
      data: {
        orgId,
        category: "salaries",
        description:
          body.description?.trim() ||
          `Salary — ${beneficiary.name?.trim() || beneficiary.email}`,
        notes: body.notes?.trim() || "Recorded by HR — pending finance approval",
        source: "Cres Dynamics Payroll",
        transactionCode: body.transactionCode?.trim() || `HR-PAY-${Date.now()}`,
        account: body.account?.trim() || "Payroll",
        paymentMethod: "bank",
        amount: new Prisma.Decimal(String(body.amount)),
        currency: body.currency?.trim() || "KES",
        spentAt: new Date(body.spentAt),
        status: "pending",
        beneficiaryUserId: beneficiary.id,
        expenseSubtype: "salary"
      }
    });

    await prisma.approval.create({
      data: {
        orgId,
        entityType: "expense",
        entityId: expense.id,
        status: "pending",
        requesterId: actorId
      }
    });

    await logAdminActivity(prisma, {
      orgId,
      type: "hr.payroll.recorded",
      summary: `HR recorded salary for ${beneficiary.email}`,
      actorId,
      entityType: "expense",
      entityId: expense.id,
      metadata: { amount: String(body.amount), beneficiaryId: beneficiary.id }
    });

    res.status(201).json({
      ok: true,
      expenseId: expense.id,
      message: "Salary expense queued for finance/admin approval"
    });
  });

  return router;
}
