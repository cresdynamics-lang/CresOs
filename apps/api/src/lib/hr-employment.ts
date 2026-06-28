import type { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "../modules/auth-middleware";

/** Internal staff roles HR can provision (not client). */
export const HR_MANAGEABLE_ROLE_KEYS = [
  ROLE_KEYS.director,
  ROLE_KEYS.finance,
  ROLE_KEYS.developer,
  ROLE_KEYS.sales,
  ROLE_KEYS.analyst,
  ROLE_KEYS.hr,
  ROLE_KEYS.project_manager,
  ROLE_KEYS.admin
] as const;

export const HR_EMPLOYEE_ROLE_KEYS = [...HR_MANAGEABLE_ROLE_KEYS] as string[];

export function isHrStaffRole(roleKey: string): boolean {
  return HR_EMPLOYEE_ROLE_KEYS.includes(roleKey);
}

export async function resolveReportsToDirectorId(
  prisma: PrismaClient,
  orgId: string,
  reportsToDirectorId: string | null | undefined,
  forUserId?: string
): Promise<{ value: string | null } | { error: string }> {
  if (reportsToDirectorId === null || reportsToDirectorId === undefined || reportsToDirectorId === "") {
    return { value: null };
  }
  const director = await prisma.user.findFirst({
    where: { id: reportsToDirectorId, orgId, deletedAt: null },
    include: { roles: { include: { role: true } } }
  });
  const isLeader = director?.roles.some(
    (r) => r.role.key === ROLE_KEYS.director || r.role.key === ROLE_KEYS.admin
  );
  if (!isLeader) {
    return { error: "Reports-to must be a director or admin" };
  }
  if (forUserId && reportsToDirectorId === forUserId) {
    return { error: "A user cannot report to themselves" };
  }
  return { value: reportsToDirectorId };
}

export async function assertNoDirectorFinanceConflict(
  prisma: PrismaClient,
  userId: string,
  addingRoleKey: string
): Promise<string | null> {
  if (addingRoleKey !== ROLE_KEYS.director && addingRoleKey !== ROLE_KEYS.finance) {
    return null;
  }
  const existing = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true }
  });
  const keys = new Set(existing.map((r) => r.role.key));
  if (addingRoleKey === ROLE_KEYS.director && keys.has(ROLE_KEYS.finance)) {
    return "Cannot add director role: user already has finance role";
  }
  if (addingRoleKey === ROLE_KEYS.finance && keys.has(ROLE_KEYS.director)) {
    return "Cannot add finance role: user already has director role";
  }
  return null;
}

const employeeSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  notificationEmail: true,
  status: true,
  createdAt: true,
  jobTitle: true,
  employmentType: true,
  hireDate: true,
  monthlySalary: true,
  reportsToDirectorId: true,
  capabilityFlags: true,
  profileCompletedAt: true,
  reportsToDirector: {
    select: { id: true, name: true, email: true }
  },
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          key: true,
          department: { select: { id: true, name: true } }
        }
      }
    }
  }
} as const;

export async function listHrEmployees(prisma: PrismaClient, orgId: string) {
  const users = await prisma.user.findMany({
    where: {
      orgId,
      deletedAt: null,
      roles: { some: { role: { key: { in: HR_EMPLOYEE_ROLE_KEYS } } } }
    },
    select: employeeSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }]
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    notificationEmail: user.notificationEmail,
    status: user.status,
    createdAt: user.createdAt,
    jobTitle: user.jobTitle,
    employmentType: user.employmentType,
    hireDate: user.hireDate,
    monthlySalary: user.monthlySalary != null ? Number(user.monthlySalary) : null,
    reportsToDirectorId: user.reportsToDirectorId,
    reportsToDirector: user.reportsToDirector,
    capabilityFlags: user.capabilityFlags,
    profileCompletedAt: user.profileCompletedAt,
    roles: user.roles.map((r) => r.role),
    departments: user.roles
      .map((r) => r.role.department)
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .reduce(
        (unique, dept) => {
          if (!unique.find((d) => d.id === dept.id)) unique.push(dept);
          return unique;
        },
        [] as Array<{ id: string; name: string }>
      )
  }));
}
