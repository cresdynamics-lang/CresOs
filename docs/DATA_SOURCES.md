# Where CresOS data comes from

## Database (PostgreSQL)

All authenticated API routes read and write through **Prisma** to the **`DATABASE_URL`** database. There is no separate mock data store for production flows.

## Finance & approvals

| Surface | Source |
|--------|--------|
| Finance report (`GET /finance/report`) | Aggregates: `Payment`, `Invoice`, `Expense` (approved/paid only), `Payout` (pending = `paidAt` null, not deleted) |
| Pending approvals | `Approval` rows (`status: pending`, `entityType` expense or payout) |
| Admin approve / decline | Updates `Approval`, `Expense.status`, and for payouts `Payout.paidAt` (approve) or `Payout.deletedAt` (reject/cancel) |

**Expense amounts in reports and analytics** include only **`approved`** and **`paid`** expenses so totals match “created and approved”.

## Dashboard & header

| Surface | Source |
|--------|--------|
| `GET /dashboard/attention` | `Notification`, `Lead`, `Approval`, tasks, etc. |
| `GET /analytics/summary` | Counts/aggregates on org-scoped tables |
| `GET /director/dashboard` | Director view aggregates |
| Header pending approvals | `GET /finance/approvals` (same rows as DB) |

## UI refresh

After a finance decision (or submit for approval), the web app dispatches **`cresos:data-refresh`** so the dashboard, finance, and header refetch from the API without waiting for a full page reload. Returning to the tab also triggers a refresh.
