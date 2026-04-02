import type { Server } from "http";
import type { PrismaClient } from "@prisma/client";

const SHUTDOWN_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;

/**
 * Stops accepting connections, closes Prisma, then exits. Safe for Kubernetes / Docker SIGTERM.
 */
export function registerGracefulShutdown(server: Server, prisma: PrismaClient): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.info(`[shutdown] ${signal} received, draining connections (${SHUTDOWN_MS}ms max)...`);

    const t = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error("[shutdown] force exit after timeout");
      process.exit(1);
    }, SHUTDOWN_MS);

    server.close((err) => {
      clearTimeout(t);
      if (err) {
        // eslint-disable-next-line no-console
        console.error("[shutdown] server.close error", err);
      }
      void prisma
        .$disconnect()
        .then(() => {
          // eslint-disable-next-line no-console
          console.info("[shutdown] Prisma disconnected, exiting");
          process.exit(0);
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error("[shutdown] Prisma disconnect error", e);
          process.exit(1);
        });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
