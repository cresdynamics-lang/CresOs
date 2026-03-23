# CresOS — testing & verification

See **[DATA_SOURCES.md](./DATA_SOURCES.md)** for which API routes read which database tables (no mock finance store).

## Automated checks (CI-friendly)

From the **repository root**:

| Command | What it runs |
|--------|----------------|
| `npm run test` | API **Vitest** suite (`apps/api`): health, auth boundaries, optional DB integration when `DATABASE_URL` is set |
| `npm run build` | API `tsc` + Web `next build` |
| `npm run lint:web` | Web `tsc --noEmit` (Next.js 16 no longer ships `next lint` in this project; typecheck replaces it) |
| `npm run verify` | `test` + `build` + `lint:web` |

From **apps/api** only:

- `npm run test` — Vitest
- `npm run build` — compile to `dist/`

From **apps/web** only:

- `npm run build` — production Next build
- `npm run lint` — `tsc --noEmit`

## API test scope (`apps/api/tests/api.test.ts`)

1. **Always (no DB required)**  
   - `GET /health` — 200, `status: ok`  
   - `GET /account/me` without `Authorization` — 401  
   - `GET /analytics/summary` without token — 401  

2. **When `DATABASE_URL` is set** (PostgreSQL)  
   - `POST /auth/register` → org + user + token; response includes `org.name`  
   - `POST /auth/login` → token + `org`  
   - `GET /account/me` with Bearer token → 200, `org` present  
   - `GET /analytics/summary` as newly registered Director → 200, `activeProjects` and `teamMembers` numeric  

Integration tests are **skipped** if `DATABASE_URL` is unset (e.g. some sandboxes).

## Manual / E2E (not automated here)

- **Web UI**: sign in, dashboard, finance, approvals, admin oversight, activity log — exercise against a running API + DB.  
- **Prisma**: `cd apps/api && npx prisma migrate deploy` (or `migrate dev`) against your database before API tests that need DB.

## Implementation notes

- `apps/api/src/create-app.ts` exports `createApp(prisma)` for tests and production (`index.ts` listens on `PORT`).
- Auth middleware still uses its own Prisma singleton; tests use the same `DATABASE_URL`, so sessions resolve correctly.
