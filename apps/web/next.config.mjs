import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Treat the monorepo root as the workspace root to avoid
    // "Next.js inferred your workspace root" warnings.
    root: path.join(__dirname, "..", "..")
  }
};

export default nextConfig;

