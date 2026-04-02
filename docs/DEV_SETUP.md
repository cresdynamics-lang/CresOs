# Local development & CI

## Database

1. Set `DATABASE_URL` in `apps/api/.env` (PostgreSQL).
2. Apply schema:

   ```bash
   cd apps/api && npx prisma migrate deploy
   ```

   For local iteration with new migrations: `npx prisma migrate dev`.

If migrations are not applied, API calls that touch newer columns (e.g. `User.notificationPreferences`) will fail at runtime.

## Running the API

```bash
cd apps/api && npm run dev
```

- **`GET /health`** — liveness (no DB call); use for “is the process up?”
- **`GET /health/ready`** — readiness (runs `SELECT 1`); use for orchestration / load balancers that need DB

Production settings:

- **`NODE_ENV=production`** — requires a strong **`JWT_SECRET`** (not `dev-secret`).
- **`DATABASE_URL`** — required in production (throws at startup if missing).
- Graceful shutdown: **`SIGTERM` / `SIGINT`** close the HTTP server and **`prisma.$disconnect()`** (Kubernetes-friendly). Optional **`SHUTDOWN_TIMEOUT_MS`** (default 10s).

## Docker Compose (API + Postgres)

From the repo root:

```bash
docker compose up --build
```

API on port **4000**, Postgres on **5432**. Set **`JWT_SECRET`** in the environment for real use (`docker compose` reads `.env`).

The API container runs **`prisma migrate deploy`** on startup, then **`node dist/index.js`**.

## API tests

```bash
# from repo root
npm run test:api
```

Requires `DATABASE_URL`. Tests register users, finance flows, notification preferences, sales project creation, `/health/ready`, etc.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR: Postgres service, `prisma migrate deploy`, API tests + build, web build + typecheck.

## AI (Groq)

Optional. Set `GROQ_API_KEY` in `apps/api/.env` for:

- Reminder copy (tasks, leads, meetings)
- Client project update drafts (`POST /projects/:id/client-message`)
- AI alignment notifications (triggered from `GET /dashboard/attention`, throttled)

Without the key, the API falls back to static text or skips AI-only notification batches.

## Verify (tests + build + web lint)

```bash
npm run verify
```
