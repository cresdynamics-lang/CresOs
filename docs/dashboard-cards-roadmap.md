# Dashboard card rows — rollout checklist

Shared primitives live in `apps/web/components/dashboard-card-row.tsx`:

- **`DashboardCardRow`** — horizontal scroll + snap on small screens; optional **`layout="scroll"`** for a single row at all widths; from **`lg`** up switches to a CSS grid when `layout` is **`responsive`** (default).
- **`DashboardScrollCard`** — fixed minimum width per card in scroll mode; use **`width="wide"`** for larger tiles (nav links, attention columns).

## Done (this pass)

- [x] Main **`/dashboard`** — alert triad (messages / projects / inquiries), quick action KPI links, developer overview tiles, navigate cards, org KPI columns, admin summary tiles, stat strip (notifications, messages, due, progress, streak), “what needs your attention” columns, performance strip.
- [x] **`/sales`** — invoice stats strip; hub destination cards.
- [x] **`/finance`** — top finance report summary tiles.
- [x] **`/sales/invoices`** and **`/finance/invoices`** — dashboard tab stat cards (single scroll row).

## Still to do (by area)

### Main dashboard (`apps/web/app/dashboard/page.tsx`)

- [x] Director / admin **“Director overview — aligned view”** (Financial / Sales / Operational / Approval queue) → single scroll row with column cards.
- [x] **Org summary metrics** (Leads this week, Deals won, Active projects, Revenue received, Invoices outstanding) → single scroll row.
- [ ] **Director-only** vs **admin** — other remaining `grid grid-cols` blocks further down the file (search `grid grid-cols` in this file).
- [ ] **Client** role home — confirm `/dashboard` client sections use the same row pattern where cards exist.
- [ ] Any remaining **shell** grids for meetings / handoffs / projects preview lists (list vs card — decide per block).

### Admin

- [ ] **`apps/web/app/admin/admin-console.tsx`** (or related) — console tabs, user/org summaries, stat chips → row + scroll on narrow screens.

### CRM & leads

- [ ] **`/crm`**, **`/leads`**, **`/leads/[id]`** — pipeline / summary chips in one row on mobile.

### Projects & delivery

- [ ] **`/projects`**, **`/projects/[id]`** — health cards, milestone strips, assignment summaries.

### Analytics

- [ ] **`/analytics`** — filter chips and KPI tiles.

### Schedule & meetings

- [ ] **`/schedule`**, **`/meeting-requests`** — period selectors + summary cards.

### Reports

- [ ] **`/reports`**, **`/reports/new`**, **`/reports/[id]`**, **`/reports/ai`** — submission stats / review banners as horizontal cards where applicable.

### Settings & account

- [ ] **`/settings/*`** — compact preference groups (lower priority).

### Client-facing surfaces

- [ ] Any **client** role landing or portal routes that still use multi-column grids for summary metrics — align with `DashboardCardRow`.

### API / data (optional follow-ups)

- [ ] Normalize **dashboard JSON** shapes so each role can render the same card schema (title, value, href, tone) from one endpoint where feasible.

### QA

- [ ] **Mobile** Safari / Chrome — horizontal scroll, snap, and tap targets on all updated pages.
- [ ] **Keyboard** — focus order through scrollable rows.
- [ ] **RTL** — if introduced later, re-test card row spacing.

---

Update this file as sections are migrated. Prefer **`layout="scroll"`** when the design calls for **always one row** (many KPIs); use default **`responsive`** when a **wide desktop grid** is still desired.
