import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";
import { notifyAdminsInApp } from "./director-notifications";
import { resolveClientPortalLogin } from "../lib/client-portal-login";
import {
  accountBlockCode,
  accountBlockMessage,
  isAccountDisabled
} from "../lib/user-account-status";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = "1h";
const REFRESH_EXPIRES_IN = "7d";

function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Org that self-service signups join (pending admin approval). */
async function resolveRegistrationOrg(
  prisma: PrismaClient
): Promise<{ id: string; name: string; slug: string } | null> {
  const slugPref = (process.env.REGISTER_ORG_SLUG || "cresdynamics").trim().toLowerCase();
  if (slugPref) {
    const bySlug = await prisma.org.findFirst({ where: { slug: slugPref } });
    if (bySlug) return { id: bySlug.id, name: bySlug.name, slug: bySlug.slug };
  }
  const first = await prisma.org.findFirst({ orderBy: { createdAt: "asc" } });
  return first ? { id: first.id, name: first.name, slug: first.slug } : null;
}

async function ensureOrgDefaultRoles(tx: any, orgId: string) {
  const defs: { name: string; key: string }[] = [
    { name: "Director", key: ROLE_KEYS.director },
    { name: "Admin", key: ROLE_KEYS.admin },
    { name: "Sales", key: ROLE_KEYS.sales },
    { name: "Developer", key: ROLE_KEYS.developer },
    { name: "Finance", key: ROLE_KEYS.finance },
    { name: "Analyst", key: ROLE_KEYS.analyst },
    { name: "Client", key: ROLE_KEYS.client }
  ];
  for (const d of defs) {
    const existing = await tx.role.findFirst({ where: { orgId, key: d.key } });
    if (!existing) {
      await tx.role.create({ data: { orgId, name: d.name, key: d.key } });
    }
  }
}

function signTokens(payload: {
  userId: string;
  orgId: string;
  roleKeys: string[];
  sessionId: string;
}) {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    // Actual expiry is enforced via SecurityConfig in auth middleware
    expiresIn: "1h"
  });
  const refreshToken = jwt.sign(
    { userId: payload.userId, orgId: payload.orgId, sessionId: payload.sessionId },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken };
}

export default function authRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Self-service signup: join existing org as pending (admin must approve).
  // If no org exists yet, bootstrap first workspace owner (director) as active.
  router.post("/register", async (req, res) => {
    const { orgName, name, email, password } = req.body as {
      orgName?: string;
      name?: string;
      email: string;
      password: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const emailNorm = normalizeEmail(email);
    if (!emailNorm || !emailNorm.includes("@")) {
      res.status(400).json({ error: "Enter a valid email" });
      return;
    }

    try {
      const existing = await prisma.user.findFirst({
        where: {
          email: { equals: emailNorm, mode: "insensitive" },
          deletedAt: null
        }
      });
      if (existing) {
        if ((existing.status ?? "").toLowerCase() === "pending") {
          res.status(400).json({
            error: "This email is already registered and awaiting admin approval."
          });
          return;
        }
        res.status(400).json({ error: "Email already in use" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const existingOrg = await resolveRegistrationOrg(prisma);

      // First install only: allow bootstrap when no organisations exist.
      if (!existingOrg) {
        if (!orgName || !String(orgName).trim()) {
          res.status(400).json({
            error: "Workspace name is required",
            hint: "No organisation exists yet. Provide an organisation name to create the first workspace."
          });
          return;
        }
        const slug = String(orgName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!slug) {
          res.status(400).json({ error: "Organization name must include a letter or number" });
          return;
        }

        const result = await prisma.$transaction(async (tx) => {
          const org = await tx.org.create({
            data: { name: String(orgName).trim(), slug }
          });
          const user = await tx.user.create({
            data: {
              email: emailNorm,
              name: name?.trim() || null,
              passwordHash,
              status: "active",
              org: { connect: { id: org.id } }
            }
          });
          await ensureOrgDefaultRoles(tx, org.id);
          const directorRole = await tx.role.findFirst({
            where: { orgId: org.id, key: ROLE_KEYS.director }
          });
          if (!directorRole) throw new Error("Director role missing after bootstrap");
          await tx.orgMember.create({
            data: { orgId: org.id, userId: user.id, roleId: directorRole.id }
          });
          await tx.userRole.create({
            data: { userId: user.id, roleId: directorRole.id }
          });
          const session = await tx.session.create({
            data: { orgId: org.id, userId: user.id }
          });
          return {
            org,
            user,
            roleKeys: [directorRole.key],
            sessionId: session.id
          };
        });

        const tokens = signTokens({
          userId: result.user.id,
          orgId: result.org.id,
          roleKeys: result.roleKeys,
          sessionId: result.sessionId
        });

        res.json({
          status: "active",
          bootstrapped: true,
          org: { id: result.org.id, name: result.org.name, slug: result.org.slug },
          user: { id: result.user.id, email: result.user.email, name: result.user.name },
          orgId: result.org.id,
          roleKeys: result.roleKeys,
          ...tokens
        });
        return;
      }

      // Normal path: pending membership, no roles until admin assigns them.
      const user = await prisma.$transaction(async (tx) => {
        await ensureOrgDefaultRoles(tx, existingOrg.id);
        const created = await tx.user.create({
          data: {
            email: emailNorm,
            name: name?.trim() || null,
            passwordHash,
            status: "pending",
            org: { connect: { id: existingOrg.id } }
          }
        });
        await tx.orgMember.create({
          data: {
            orgId: existingOrg.id,
            userId: created.id,
            roleId: null
          }
        });
        return created;
      });

      await prisma.eventLog.create({
        data: {
          orgId: existingOrg.id,
          actorId: user.id,
          type: "auth.register.pending",
          entityType: "user",
          entityId: user.id,
          metadata: { email: emailNorm }
        }
      });

      await notifyAdminsInApp(
        prisma,
        existingOrg.id,
        "New registration awaiting approval",
        `${user.name?.trim() || user.email} (${user.email}) requested access. Approve them under Admin → Users, then assign roles.`,
        { type: "admin.user.pending_registration", tier: "structural" }
      );

      res.status(201).json({
        status: "pending",
        pendingApproval: true,
        message:
          "Registration received. An administrator must approve your account before you can sign in. You will receive an email when approved."
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("POST /auth/register failed", e);
      res.status(500).json({
        error: "Registration failed",
        hint: "Ensure the database is migrated (e.g. prisma migrate deploy) and DATABASE_URL is correct."
      });
    }
  });

  /**
   * Email-step for progressive login UI.
   * Reports whether this address can proceed to password (user or client portal), without revealing secrets.
   */
  router.post("/check-email", async (req, res) => {
    const emailNorm = normalizeEmail((req.body as { email?: string })?.email ?? "");
    if (!emailNorm || !emailNorm.includes("@")) {
      res.status(400).json({ error: "Enter a valid email", exists: false });
      return;
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          email: { equals: emailNorm, mode: "insensitive" },
          deletedAt: null
        },
        select: { id: true, status: true }
      });

      if (user) {
        const block = accountBlockCode(user.status);
        if (block) {
          res.json({
            exists: true,
            canLogin: false,
            code: block,
            message: accountBlockMessage(block)
          });
          return;
        }
        res.json({ exists: true, canLogin: true });
        return;
      }

      const client = await prisma.client.findFirst({
        where: {
          email: { equals: emailNorm, mode: "insensitive" },
          deletedAt: null
        },
        select: { id: true }
      });

      if (client) {
        res.json({ exists: true, canLogin: true });
        return;
      }

      res.json({ exists: false, canLogin: false });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("POST /auth/check-email failed", e);
      res.status(500).json({ error: "Could not verify email", exists: false });
    }
  });

  router.post("/login", async (req, res) => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };
    if (!email || !password) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    const emailNorm = normalizeEmail(email);
    if (!emailNorm) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    try {
      let user = await prisma.user.findFirst({
        where: {
          email: { equals: emailNorm, mode: "insensitive" },
          deletedAt: null
        },
        include: {
          memberships: { include: { org: true, role: true } },
          roles: { include: { role: true } }
        }
      });

      let authenticated = false;
      if (user?.passwordHash) {
        authenticated = await bcrypt.compare(password, user.passwordHash);
      }

      if (!authenticated) {
        const portalUser = await resolveClientPortalLogin(prisma, emailNorm, password);
        if (portalUser) {
          user = portalUser;
          authenticated = true;
        }
      }

      if (!user || !authenticated) {
        if (user?.orgId) {
          await prisma.adminAlert.create({
            data: {
              orgId: user.orgId,
              type: "failed_login",
              severity: "warning",
              details: { userId: user.id, email: emailNorm }
            }
          });
        }
        res.status(400).json({
          error: "Invalid credentials. Check with admin."
        });
        return;
      }

      if (isAccountDisabled(user.status)) {
        const code = accountBlockCode(user.status) ?? "ACCOUNT_DISABLED";
        res.status(403).json({
          error: accountBlockMessage(code),
          code
        });
        return;
      }

      const primaryOrg = user.orgId ?? user.memberships[0]?.orgId;
      if (!primaryOrg) {
        res.status(400).json({ error: "User not associated with an org" });
        return;
      }

      const roleKeys = [
        ...new Set([
          ...user.memberships.map((m) => m.role?.key).filter(Boolean),
          ...user.roles.map((r) => r.role.key)
        ])
      ] as string[];

      const ip =
        (typeof req.headers["x-forwarded-for"] === "string" && req.headers["x-forwarded-for"].split(",")[0]?.trim()) ||
        req.socket?.remoteAddress ||
        null;
      const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

      const session = await prisma.session.create({
        data: {
          orgId: primaryOrg,
          userId: user.id,
          ip: ip ?? undefined,
          userAgent: userAgent ?? undefined
        }
      });

      const isClientPortalLogin = roleKeys.includes(ROLE_KEYS.client);
      const loginEventType = isClientPortalLogin ? "client.portal.login" : "auth.login.success";
      const loginSummary = isClientPortalLogin
        ? `Client portal login: ${user.name?.trim() || user.email}`
        : "User logged in";

      try {
        await prisma.eventLog.create({
          data: {
            orgId: primaryOrg,
            actorId: user.id,
            type: loginEventType,
            entityType: "session",
            entityId: session.id,
            metadata: { email: emailNorm, ip, userAgent, roleKeys }
          }
        });
        await logAdminActivity(prisma, {
          orgId: primaryOrg,
          type: loginEventType,
          summary: loginSummary,
          body: `${user.name?.trim() || user.email} logged in.${ip ? ` IP: ${ip}.` : ""}${userAgent ? ` UA: ${userAgent.slice(0, 180)}${userAgent.length > 180 ? "…" : ""}` : ""}`,
          actorId: user.id,
          entityType: "session",
          entityId: session.id,
          metadata: { ip, userAgent, roleKeys, clientPortal: isClientPortalLogin }
        });
        await notifyAdminsInApp(
          prisma,
          primaryOrg,
          "[Visibility] User login",
          `${user.name?.trim() || user.email} logged in.${ip ? ` IP: ${ip}.` : ""}`,
          { type: "auth.login.success.admin_mirror", tier: "structural", excludeUserIds: [user.id] }
        );
      } catch {
        // ignore audit logging failures
      }

      const tokens = signTokens({
        userId: user.id,
        orgId: primaryOrg,
        roleKeys,
        sessionId: session.id
      });

      const org = await prisma.org.findUnique({
        where: { id: primaryOrg },
        select: { id: true, name: true, slug: true }
      });

      res.json({
        user: { id: user.id, email: user.email, name: user.name },
        org: org
          ? { id: org.id, name: org.name, slug: org.slug }
          : { id: primaryOrg, name: null as string | null, slug: null as string | null },
        orgId: primaryOrg,
        roleKeys,
        ...tokens
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("POST /auth/login failed", e);
      res.status(500).json({
        error: "Login temporarily unavailable",
        hint: "Confirm Postgres is running and DATABASE_URL in apps/api/.env matches (e.g. localhost:5434 after docker compose)."
      });
    }
  });

  router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: "Missing refreshToken" });
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as {
        userId: string;
        orgId: string;
        sessionId?: string;
      };
      if (!decoded.sessionId) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }

      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId }
      });
      if (!session || session.revokedAt) {
        res.status(401).json({ error: "Session revoked" });
        return;
      }
      if (session.orgId !== decoded.orgId || session.userId !== decoded.userId) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          memberships: { include: { role: true } },
          roles: { include: { role: true } }
        }
      });
      if (!user || user.status !== "active" || user.deletedAt) {
        res.status(401).json({ error: "User is not active" });
        return;
      }

      const roleKeys = [
        ...new Set([
          ...user.memberships.map((m) => m.role?.key).filter(Boolean),
          ...user.roles.map((r) => r.role.key)
        ])
      ] as string[];

      const accessToken = jwt.sign(
        {
          userId: user.id,
          orgId: session.orgId,
          roleKeys,
          sessionId: session.id
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      res.json({ accessToken });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TokenExpiredError") {
        res.status(401).json({ error: "Refresh token expired" });
        return;
      }
      res.status(401).json({ error: "Invalid refresh token" });
    }
  });

  return router;
}

