# CresOS Sales (Go)

Full **sales workspace in Go** with **HTML pages** + JSON APIs, sharing the same Postgres and JWT secret as the Node API.

## Pages
| Path | Purpose |
|------|---------|
| `/login` | Sign in (sales / admin / director / finance / analyst) |
| `/sso` | Handoff from Next.js (`?token=` Node access token) |
| `/` | Overview dashboard (KPIs, alerts, charts, recent invoices) |
| `/crm` | CRM contacts hub |
| `/leads` | Leads table |
| `/deals` | Deals table |
| `/invoices` | Invoices table |
| `/reports` | Sales reports list + draft/submit |
| `/messages` | Mail compose (logs to `EventLog`; Resend still on Node) |

## JSON API
- `GET /api/sales/dashboard`
- `GET /api/sales/invoices`
- `GET /api/crm/leads`
- `GET /api/crm/deals`
- `GET /api/reports`
- `GET /health`

## Run
```bash
# Postgres on :5435 (same as apps/api)
cp .env.example .env
# Align DATABASE_URL + JWT_SECRET with apps/api/.env

go mod tidy
go run ./cmd/server
# http://localhost:4100
```

Sign in with any CresOS user that has sales workspace access (e.g. sales or admin seed users).

## Layout
```
apps/sales-go/
  cmd/server/main.go
  internal/auth/
  internal/config/
  internal/store/
  internal/web/          # HTTP + HTML templates + CSS
  .env.example
```

This does **not** replace `apps/web` yet — it is the Go sales surface (options 2+3) you can run beside the monorepo.
