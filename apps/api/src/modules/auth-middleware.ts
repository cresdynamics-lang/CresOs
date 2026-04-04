import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

export interface AuthContext {
  userId: string;
  orgId: string;
  roleKeys: string[];
  sessionId?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

export const ROLE_KEYS = {
  admin: "admin",
  director: "director_admin",
  finance: "finance",
  developer: "developer",
  sales: "sales",
  analyst: "analyst",
  client: "client"
} as const;

/** Every product role — Community and shared features use this so all logged-in org users stay included. */
export const ALL_APP_ROLE_KEYS: string[] = Object.values(ROLE_KEYS);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/**
 * Use the same PrismaClient instance as `createApp(prisma)` so sessions and routes share one pool.
 */
export function createAuthMiddleware(prisma: PrismaClient) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = header.substring("Bearer ".length);

    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthContext;

      if (!payload.sessionId) {
        res.status(401).json({ error: "Invalid session" });
        return;
      }

      prisma.session
        .findUnique({ where: { id: payload.sessionId } })
        .then(async (session) => {
          if (!session || session.revokedAt) {
            res.status(401).json({ error: "Session revoked" });
            return;
          }

          const user = await prisma.user.findUnique({
            where: { id: session.userId }
          });

          if (!user || user.status !== "active") {
            res.status(401).json({ error: "User is not active" });
            return;
          }

          void prisma.session.update({
            where: { id: session.id },
            data: { lastSeenAt: new Date() }
          });

          req.auth = payload;
          next();
        })
        .catch(() => {
          res.status(401).json({ error: "Invalid token" });
        });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}

export function requireRoles(required: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const hasRole = auth.roleKeys.some((key) => required.includes(key));
    if (!hasRole) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

