# CresOS Developer (Go)

Promage-style **developer workspace** in Go (HTML pages), sharing Postgres + JWT with the Node API.

## Pages
| Path | Purpose |
|------|---------|
| `/login` | Sign in (developer / admin / director / PM) |
| `/sso` | Handoff from Next.js login (`?token=`) |
| `/` | Dashboard — KPIs, project summary, progress, today tasks, workload |
| `/projects` | Assigned projects + delivery progress |
| `/tasks` | Task board with status updates |
| `/reports` | Developer daily reports |
| `/performance` | Streak, throughput, hours, expectations |

## Run
```bash
cd apps/developer-go
cp .env.example .env   # align DATABASE_URL + JWT_SECRET with apps/api
go mod tidy
go run ./cmd/server
# http://localhost:4200
```

Seed user: `wilson.developer@cresdynamics.com` / `Cres@Team2026#`

Wire from Next.js by setting in `apps/web/.env`:
```
NEXT_PUBLIC_DEVELOPER_GO_URL=http://localhost:4200
NEXT_PUBLIC_SALES_GO_URL=http://localhost:4100
```
