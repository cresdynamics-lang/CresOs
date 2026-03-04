import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ROLE_KEYS } from "./auth-middleware";

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

    const tokens = signTokens({
      userId: user.id,
      orgId: primaryOrg,
      roleKeys,
      sessionId: session.id
    });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      orgId: primaryOrg,
      roleKeys,
      ...tokens
    });
  });

  router.post("/refresh", (req, res) => {
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
      // For simplicity we reuse the existing session if present
      const accessToken = jwt.sign(
        {
          userId: decoded.userId,
          orgId: decoded.orgId,
          roleKeys: [],
          sessionId: decoded.sessionId ?? ""
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      res.json({ accessToken });
    } catch {
      res.status(401).json({ error: "Invalid refresh token" });
    }
  });

  return router;
}

