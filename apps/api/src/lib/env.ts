/**
 * Validates environment at process start. Call from `index.ts` before listening.
 * Throws if required variables are missing in production.
 */
export function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  if (!process.env.DATABASE_URL?.trim()) {
    const msg = "DATABASE_URL is required";
    if (isProd) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(`[env] ${msg} — API will not connect to PostgreSQL.`);
  }

  if (isProd) {
    const jwt = process.env.JWT_SECRET?.trim();
    if (!jwt || jwt === "dev-secret") {
      throw new Error("JWT_SECRET must be set to a strong secret in production (not dev-secret).");
    }
  }
}
