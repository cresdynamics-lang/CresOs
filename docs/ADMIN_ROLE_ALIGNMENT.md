# Cres Dynamics ERP — Admin Role Alignment

Operational reference for **Admin** in CresOS. Aligns product behavior, governance, and AI assistance.

## Role identity

- **Operational oversight** — final checkpoint between internal requests and execution.
- **Does not** originate projects or leads, write code, or execute client deliverables.
- **Ensures** every platform action is authorised, traceable, and aligned with company standards.
- **Only role** that can **authorise financial transactions** requested by Finance (expense/payout approvals). This authority is not delegated in-app.

## What Admin can see

1. All **active and demo projects** — name, assigned developer, status, progress signals, deadlines (where surfaced in UI/API).
2. **Developer activity** — assignments, in-progress work, overdue signals, swap/handoff notifications.
3. **Project delays** — items that miss update windows or deadlines (dashboard/attention surfaces).
4. **Finance requests** — pending transaction authorisation from Finance (amount, purpose, notes via approval records).
5. **Team / performance reports** — completion rates, utilisation summaries, finance history aggregates (as implemented in Admin/Analytics).
6. **Restricted** — Admin should **not** rely on raw client PII or granular client pricing except as surfaced through **approved** financial or CRM flows (implementations may mask phone/email on certain views).

## Finance approval decision logic

1. Finance submits → Admin receives notification; **act on every request**; >24h pending → escalation (reminders/queues as implemented).
2. **Approve** — review amount, purpose, documentation; approve to release execution to Finance.
3. **Decline** — **written reason required** (what is missing, rule violated, or info needed). Enforced in API for reject decisions.
4. **Clarification** — return to Finance with questions (workflow may use status/note; extend as needed).
5. Admin **does not** initiate, edit, or execute ledger transactions — **approve / decline / cancel** only on approval queue.

## Project & team oversight

1. **Monitor** projects; **does not** assign/reassign developers (Sales/Director flows).
2. **Swap/handoff** — notified; no approval required unless product rules say otherwise; repeated patterns → flag Director (manual/process).
3. **Delays** — no update in window, or deadline passed with incomplete work → surface on dashboards.
4. **Reports** — export/progress views: project, developer, modules, %, days since update (where API supports).
5. **Cannot** edit task content, module text, or project scope (enforced by role on write endpoints).

## Communication & audit

1. Decisions logged in **event log / audit** with timestamp, actor, and note where applicable.
2. Decline notes must answer: missing what, which rule, or what must change.
3. Official approvals/declines **in platform** (notifications, Approvals UI, Activity).
4. **No direct client comms** as Admin — route via Sales/Finance.

## Hard limits (Admin cannot)

- Assign or reassign projects to developers.
- Approve **project** assignment (Director-only gates).
- Execute, initiate, or modify financial ledger entries outside the approval queue.
- View/use client personal data or raw pricing outside governed surfaces (product goal).
- Edit project scope, task descriptions, or module content (writes restricted).
- Decline a Finance request **without** a written explanation (enforced for `rejected`).
- Override Director’s project approval/denial outside defined workflows.

---

## Automation & oversight surfaces

1. **24h finance escalation** — Pending expense/payout approvals older than 24 hours trigger **in-app** notifications to org Admins (`type: finance_approval_escalation`, governance tier). Processing runs opportunistically when Admins load **dashboard attention** or **Admin → Oversight** (deduped per approval window).
2. **Admin Oversight API** — `GET /admin/oversight` (admin-only): counts and lists for pending finance queue, items over 24h (with requester), delayed/paused projects, pending handoffs, overdue tasks.
3. **Admin Oversight UI** — **Admin** page → **Oversight** tab calls the same endpoint and displays the summary (links to Approvals / Projects where relevant).
4. **CRM PII** — `GET /crm/clients` masks email/phone for **admin-only** viewers without finance/sales roles (see CRM module).

*Implementation notes: Finance expense/payout decisions use `POST /admin/finance-approvals/:id/decision` (admin-only). Director sees `/finance/approvals` read-only for those types.*
