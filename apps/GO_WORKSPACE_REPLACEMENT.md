# Sales + Developer Go replacement — aligned task list

Go apps replace Next.js `/sales` and `/developer` workspaces. Shared Postgres + JWT SSO.

## Production cutover (cresos.cresdynamics.com)
- [x] Docker images for `sales-go` / `developer-go`
- [x] Compose services + prod `BASE_PATH` (`/w/sales`, `/w/developer`)
- [x] Nginx proxy locations for `/w/sales/` and `/w/developer/`
- [x] Next build args `NEXT_PUBLIC_SALES_GO_URL` / `NEXT_PUBLIC_DEVELOPER_GO_URL`
- [x] Bootstrap + `scripts/cresos-enable-go-workspaces.sh` for existing droplets
- [x] Sales create project can assign developer (visible after director approval)

**Deploy on the droplet:**
```bash
cd /root/CresOs && git pull
export CRESOS_DOMAIN=cresos.cresdynamics.com
bash scripts/cresos-enable-go-workspaces.sh
```

## Phase 0 — Alignment
- [x] Audit Next.js sales vs sales-go
- [x] Audit Next.js developer vs developer-go
- [x] Scope: KEEP / ADD / DROP

## Phase 1 — Dashboard parity + graphs
### Sales-go
- [x] Actionable queue strip (report due, overdue, collection, leads, deals)
- [x] Charts: pie invoices, pie deals, h-bar projects, week schedule bars
- [x] Keep bead monthly + collection table

### Developer-go
- [x] Charts: task-mix pie, project progress bars, week schedule bars
- [x] Report **submit** form
- [x] Schedule list + complete
- [x] Daily update nudge

## Phase 2 — API / write paths
### Sales
- [x] Lead create + detail
- [x] Contacts CRUD / bulk mail
- [ ] Real Resend mail send *(queues Notification + EventLog for Node worker)*
- [x] Report Q&A detail
- [x] Project create + assign developer

### Developer
- [x] Project accept/decline + detail (approved projects only)
- [x] Task comments / blocked reason UI
- [x] Payment ack + reminder snooze

## Phase 3 — Cut over Next.js
- [x] Sales/developer login → Go SSO
- [x] `/sales/*` and `/developer` → redirect stubs
- [x] Delete overview dashboard React components
- [x] Public URLs under `/w/sales` and `/w/developer`

## Phase 4 — Ship
- [x] Smoke both Go apps
- [x] Commit + push
- [x] Align Go dashboard SQL/status labels with Prisma + Node
- [ ] Run `cresos-enable-go-workspaces.sh` on production droplet

## DROP (out of Go v1)
- Playbook rebuild, Approvals, Settings, full Community WS, AI focus-coach hard requirement
- True Resend HTTP send (queues Notification + EventLog for Node worker)
- Full AI project planner inside Go (link out to Next `/projects` for multi-role / AI scope)
- Developer adding milestones/tasks in Go (use Next project page after approval when needed)
