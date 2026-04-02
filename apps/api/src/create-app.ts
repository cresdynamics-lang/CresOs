import express from "express";
import cors from "cors";
import { json } from "express";
import type { PrismaClient } from "@prisma/client";
import authRouter from "./modules/auth";
import crmRouter from "./modules/crm";
import projectsRouter from "./modules/projects";
import financeRouter from "./modules/finance";
import analyticsRouter from "./modules/analytics";
import notificationsRouter from "./modules/notifications";
import directorRouter from "./modules/director";
import adminRouter from "./modules/admin";
import clientRouter from "./modules/client";
import reportsRouter from "./modules/reports";
import dashboardRouter from "./modules/dashboard";
import accountRouter from "./modules/account";
import scheduleRouter from "./modules/schedule";
import developerReportsRouter from "./modules/developer-reports";
import meetingRequestsRouter from "./modules/meeting-requests";
import chatCommunityRouter from "./modules/chat-community";
import salesRouter from "./modules/sales";
import userRouter from "./modules/user";
import { createAuthMiddleware } from "./modules/auth-middleware";

/**
 * Express app factory (used by `index.ts` and automated tests).
 */
export function createApp(prisma: PrismaClient): express.Application {
  const app = express();
  app.use(cors());
  app.use(json());

  /** Process is up (use for load-balancer / liveness; no DB call). */
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "cresos-api",
      timestamp: new Date().toISOString()
    });
  });

  /** Database reachable (use for readiness / orchestration). */
  app.get("/health/ready", async (_req, res) => {
    const timestamp = new Date().toISOString();
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        service: "cresos-api",
        database: "ok",
        timestamp
      });
    } catch {
      res.status(503).json({
        status: "degraded",
        service: "cresos-api",
        database: "error",
        timestamp
      });
    }
  });

  app.use("/auth", authRouter(prisma));
  app.use(createAuthMiddleware(prisma));
  app.use("/crm", crmRouter(prisma));
  app.use("/projects", projectsRouter(prisma));
  app.use("/finance", financeRouter(prisma));
  app.use("/analytics", analyticsRouter(prisma));
  app.use("/notifications", notificationsRouter(prisma));
  app.use("/director", directorRouter(prisma));
  app.use("/admin", adminRouter(prisma));
  app.use("/client", clientRouter(prisma));
  app.use("/reports", reportsRouter(prisma));
  app.use("/dashboard", dashboardRouter(prisma));
  app.use("/account", accountRouter(prisma));
  app.use("/schedule", scheduleRouter(prisma));
  app.use("/developer-reports", developerReportsRouter(prisma));
  app.use("/meeting-requests", meetingRequestsRouter(prisma));
  app.use("/chat-community", chatCommunityRouter(prisma));
  app.use("/sales", salesRouter(prisma));
  app.use("/user", userRouter(prisma));

  return app;
}
