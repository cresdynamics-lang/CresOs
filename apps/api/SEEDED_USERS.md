# Seeded test users (from `npx prisma db seed`)

**Default password (team):** `Cres@Team2026#`

**Director password:** `Henry@Cres`

| Email | Role | Notes |
|-------|------|--------|
| admin@cresdynamics.com | Admin | Full governance command center |
| director@cresdynamics.com | Director | `Henry@Cres` |
| wilson.developer@cresdynamics.com | Developer | Demo project assignee |
| finance@cresdynamics.com | Finance | Finance workspace |
| salim.sales@cresdynamics.com | Sales | Pipeline & reports |
| hr@cresdynamics.com | HR | **Password: `Cres@Team2026#`** — Hannah HR; home route **`/hr`** (employees, payroll, create users) |
| contact@acme.example | Client | **Password: `Acme1`** — Acme Retail Platform progress |

## Client portal

Clients log in with their CRM email. Password format: **first name + project #** (e.g. Acme Retail Ltd → `Acme1` for project seq 1).

After seed, open **Client portal** (`/client`) as `contact@acme.example` to see **Acme Retail Platform** progress, milestones, and tasks.

## HR workspace

Sign in as `hr@cresdynamics.com` to open **`/hr`**:

- **Employees** — create users (sales, finance, directors, developers, HR), assign roles/teams, set reporting managers, job titles, and monthly salary.
- **Payroll** — record salary payments; entries sync to Finance as pending `salaries` expenses for admin/finance approval.

## Departments (seeded)

Sales · Development · Finance · **HR** · Marketing · Operations

Run seed from API folder:

```bash
cd apps/api && npx prisma db seed
```

Ensure API is running and web uses `NEXT_PUBLIC_API_URL=http://localhost:4000` (or default).
