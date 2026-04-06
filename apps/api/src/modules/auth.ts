import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ROLE_KEYS } from "./auth-middleware";
import { logAdminActivity } from "./admin-activity";
import { notifyAdminsInApp } from "./director-notifications";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = "1h";
const REFRESH_EXPIRES_IN = "7d";

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

  // Register creates org + owner user
  router.post("/register", async (req, res) => {
    const { orgName, name, email, password } = req.body as {
      orgName: string;
      name: string;
      email: string;
      password: string;
    };

    if (!orgName || !email || !password) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) {
      res.status(400).json({ error: "Organization name must include a letter or number" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: { name: orgName, slug }
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          org: { connect: { id: org.id } }
        }
      });

      // Basic roles for this org
      const directorRole = await tx.role.create({
        data: { orgId: org.id, name: "Director", key: ROLE_KEYS.director }
      });
      await tx.role.create({
        data: { orgId: org.id, name: "Admin", key: ROLE_KEYS.admin }
      });
      await tx.role.create({
        data: { orgId: org.id, name: "Sales", key: ROLE_KEYS.sales }
      });
      await tx.role.create({
        data: { orgId: org.id, name: "Developer", key: ROLE_KEYS.developer }
      });
      await tx.role.create({
        data: { orgId: org.id, name: "Finance", key: ROLE_KEYS.finance }
      });
      await tx.role.create({
        data: { orgId: org.id, name: "Analyst", key: ROLE_KEYS.analyst }
      });
      await tx.role.create({
        data: { orgId: org.id, name: "Client", key: ROLE_KEYS.client }
      });

      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          roleId: directorRole.id
        }
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: directorRole.id
        }
      });

      const session = await tx.session.create({
        data: {
          orgId: org.id,
          userId: user.id
        }
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
      org: { id: result.org.id, name: result.org.name, slug: result.org.slug },
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      ...tokens
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

  router.post("/login", async (req, res) => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };
    if (!email || !password) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { org: true, role: true } },
        roles: { include: { role: true } }
      }
    });

    if (!user || !user.passwordHash) {
      res.status(400).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      if (user.orgId) {
        await prisma.adminAlert.create({
          data: {
            orgId: user.orgId,
            type: "failed_login",
            severity: "warning",
            details: { userId: user.id, email }
          }
        });
      }
      res.status(400).json({ error: "Invalid credentials" });
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

    const session = await prisma.session.create({
      data: {
        orgId: primaryOrg,
        userId: user.id
      }
    });

    const ip =
      (typeof req.headers["x-forwarded-for"] === "string" && req.headers["x-forwarded-for"].split(",")[0]?.trim()) ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
    try {
      await prisma.eventLog.create({
        data: {
          orgId: primaryOrg,
          actorId: user.id,
          type: "auth.login.success",
          entityType: "session",
          entityId: session.id,
          metadata: { email, ip, userAgent }
        }
      });
      await logAdminActivity(prisma, {
        orgId: primaryOrg,
        type: "auth.login.success",
        summary: "User logged in",
        body: `${user.name?.trim() || user.email} logged in.${ip ? ` IP: ${ip}.` : ""}${userAgent ? ` UA: ${userAgent.slice(0, 180)}${userAgent.length > 180 ? "…" : ""}` : ""}`,
        actorId: user.id,
        entityType: "session",
        entityId: session.id,
        metadata: { ip, userAgent }
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
      if (!user || user.status !== "active") {
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

