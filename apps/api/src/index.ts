import "dotenv/config";
import express from "express";
import cors from "cors";
import { json } from "express";
import { PrismaClient } from "@prisma/client";
import authRouter from "./modules/auth";
import crmRouter from "./modules/crm";
import projectsRouter from "./modules/projects";
import financeRouter from "./modules/finance";
import analyticsRouter from "./modules/analytics";
import notificationsRouter from "./modules/notifications";
import directorRouter from "./modules/director";
import adminRouter from "./modules/admin";
import clientRouter from "./modules/client";
import { authMiddleware } from "./modules/auth-middleware";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cresos-api",
    timestamp: new Date().toISOString()
  });
});

// Public auth routes
app.use("/auth", authRouter(prisma));

// Authenticated, org-scoped routes
app.use(authMiddleware);
app.use("/crm", crmRouter(prisma));
app.use("/projects", projectsRouter(prisma));
app.use("/finance", financeRouter(prisma));
app.use("/analytics", analyticsRouter(prisma));
app.use("/notifications", notificationsRouter(prisma));
app.use("/director", directorRouter(prisma));
app.use("/admin", adminRouter(prisma));
app.use("/client", clientRouter(prisma));

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CresOS API running on http://localhost:${PORT}`);
});

