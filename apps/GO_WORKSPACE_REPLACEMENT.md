# Sales + Developer Go replacement — aligned task list

Go apps replace Next.js `/sales` and `/developer` workspaces. Shared Postgres + JWT SSO.

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

## Phase 2 — API / write paths (remaining)
### Sales
- [ ] Lead create + detail
- [ ] Contacts CRUD / bulk mail
- [ ] Real Resend mail send
- [ ] Report Q&A detail

### Developer
- [ ] Project accept/decline + detail
- [ ] Task comments / blocked reason UI
- [ ] Payment ack + reminder snooze

## Phase 3 — Cut over Next.js
- [x] Sales/developer login → Go SSO (default URLs)
- [x] `/sales/*` and `/developer` → redirect stubs
- [x] Delete overview dashboard React components

## Phase 4 — Ship
- [ ] Smoke both Go apps
- [ ] Commit + push

## DROP (out of Go v1)
- Playbook rebuild, Approvals, Settings, full Community WS, AI focus-coach hard requirement
