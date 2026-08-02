import type { PrismaClient } from "@prisma/client";

/** Account can sign in and receive org communications. */
export function isAccountActive(status: string | null | undefined): boolean {
  return (status ?? "active").toLowerCase() === "active";
}

/** Self-registered account awaiting admin approval. */
export function isAccountPending(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "pending";
}

/** Statuses that block login and outbound communications. */
export function isAccountDisabled(status: string | null | undefined): boolean {
  return !isAccountActive(status);
}

/** Normalize status for API/login messaging. */
export function accountBlockCode(
  status: string | null | undefined
): "ACCOUNT_PENDING" | "ACCOUNT_DISABLED" | null {
  if (isAccountActive(status)) return null;
  if (isAccountPending(status)) return "ACCOUNT_PENDING";
  return "ACCOUNT_DISABLED";
}

export function accountBlockMessage(code: "ACCOUNT_PENDING" | "ACCOUNT_DISABLED"): string {
  if (code === "ACCOUNT_PENDING") {
    return "Your account is awaiting admin approval. You will receive an email when it is approved.";
  }
  return "Your account has been disabled. You will be notified when it is active again.";
}

export async function filterActiveUserIds(
  prisma: PrismaClient,
  userIds: string[]
): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, deletedAt: null, status: "active" },
    select: { id: true }
  });
  return users.map((u) => u.id);
}

/** True when the address belongs to a non-active (disabled/locked/suspended) user in the org. */
export async function isRecipientDisabledUser(
  prisma: PrismaClient,
  orgId: string,
  emailOrUserId: string
): Promise<boolean> {
  const raw = (emailOrUserId ?? "").trim();
  if (!raw) return false;

  if (!raw.includes("@")) {
    const byId = await prisma.user.findFirst({
      where: { id: raw, orgId, deletedAt: null },
      select: { status: true }
    });
    return byId ? isAccountDisabled(byId.status) : false;
  }

  const user = await prisma.user.findFirst({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { email: { equals: raw, mode: "insensitive" } },
        { notificationEmail: { equals: raw, mode: "insensitive" } }
      ]
    },
    select: { status: true }
  });
  return user ? isAccountDisabled(user.status) : false;
}
