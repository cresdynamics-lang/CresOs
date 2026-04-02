import "dotenv/config";
import http from "http";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./create-app";
import { validateEnv } from "./lib/env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";

validateEnv();

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

const app = createApp(prisma);
const PORT = Number(process.env.PORT) || 4000;

const server = http.createServer(app);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.info(`CresOS API listening on port ${PORT} (health /health, readiness /health/ready)`);
});

registerGracefulShutdown(server, prisma);
