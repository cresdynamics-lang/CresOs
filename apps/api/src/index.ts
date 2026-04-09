import dotenv from "dotenv";
import path from "path";
import http from "http";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./create-app";
import { validateEnv } from "./lib/env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";
import { scheduleDeveloperDailyDigest } from "./modules/developer-daily-digest";
import { scheduleDailyOps } from "./modules/daily-reminders-ai-reports";
import { attachChatCommunityWs } from "./modules/chat-community-ws";

// Ensure local `.env` wins over inherited environment variables in dev.
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: process.env.NODE_ENV !== "production"
});

validateEnv();

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

const app = createApp(prisma);
const PORT = Number(process.env.PORT) || 4000;

const server = http.createServer(app);

attachChatCommunityWs(server, prisma);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.info(`CresOS API listening on port ${PORT} (health /health, readiness /health/ready)`);
  scheduleDeveloperDailyDigest(prisma);
  scheduleDailyOps(prisma);
});

registerGracefulShutdown(server, prisma);
