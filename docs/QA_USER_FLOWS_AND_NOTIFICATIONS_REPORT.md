# QA report: user flows (sales → admin), settings, account, AI notifications

**Date:** 2026-03-24  
**Scope:** Automated tests, build, notification routing, Settings/Account UI vs API, AI-assisted copy, gaps.

---

## 1. Automated verification

| Check | Result | Notes |
|--------|--------|--------|
| `npm run test:api` (Vitest) | **Pass** (9 tests) | Auth, analytics, finance invoice, account notification prefs, muted bell feed, sales→project→director notification |
| `npm run build` (API + Next.js) | **Pass** | TypeScript + production build |

**Failure fixed during this QA:** Integration tests returned **500** on `POST /auth/register` because the database was missing column `User.notificationPreferences`.  

**Resolution:** Applied pending migration `20260323120000_user_notification_preferences` (`prisma migrate deploy`).  

**Hardening:** `POST /auth/register` now wraps the transaction in `try/catch`, returns JSON `{ error, hint }` on failure, and rejects empty org slugs (org name with no letters/digits).

**Operational note:** Any environment must run migrations after pulling; otherwise Prisma will throw at runtime when touching `User` fields not present in DB.

---

## 2. Role model and process flow (sales → director → admin)

Roles are created per org at registration (`apps/api/src/modules/auth.ts`): Director, Admin, Sales, Developer, Finance, Analyst, Client. The first user is **Director** (and gets Director `UserRole`).

**Typical commercial / delivery flow (as implemented in API routes and notifications):**

1. **Sales** creates a project (often `pending_approval`) → **Director** notified (`notifyDirectors`).
2. **Director** approves project → visibility to developer/finance paths; stakeholders notified as coded.
3. **Developer** works tasks; task create/update and delivery timeline changes → **Director**, **Admin** (visibility), **project creator (sales)**, **assigned developer** (`notifyProjectExecutionStakeholders` + governance emails to directors where applicable).
4. **Admin** receives in-app **structural** mirrors for governance events (`notifyDirectors` → `notifyAdminsInApp`), execution stakeholder bursts, and labeled “visibility” mirrors for reminders (tasks, leads, schedule, sales report nudge, director→owner project notices). See `director-notifications.ts`, `project-stakeholder-notifications.ts`, and reminder modules.

**Finance approvals:** Escalations target **Admin** only per existing design (`finance-approval-escalation.ts`); Director is view-only for those approvals per product rules.

This matches the intended split: **Director** = governance + dev/sales operational signals; **Admin** = broad visibility + finance escalation.

---

## 3. Settings & account

### API (`PATCH /account/me`, `GET /account/me`)

- **Account fields:** `name`, `phone`, `notificationEmail`, `notificationPreferences` (`mutedTiers`, `muteAllInApp`).
- **Server validation:** `mergeNotificationPreferences` + `parseNotificationPreferences` in `apps/api/src/lib/notification-preferences.ts` — only known tier keys are kept.

### Web UI

| Surface | Path / component | Behavior |
|---------|------------------|----------|
| Settings drawer | `SettingsPanel` + `NotificationPreferencesForm` | Tabs: Preferences (tiers + mute all), Account (name, notification email, phone). Loads/saves via `/account/me`. |
| Full-page settings | `/settings`, `/settings/account` | Preferences page embeds `NotificationPreferencesForm`; account page duplicates profile + password patterns. |

**Alignment:** UI and API both support `muteAllInApp` and `mutedTiers`.  

**Client alignment:** `notification-preferences-form.tsx` now filters `mutedTiers` to the same four tier ids as the API (`execution`, `financial`, `governance`, `structural`).

**Notification bell:** `GET /notifications/me` respects preferences (mute all, tier filters). Tier labels in UI (execution, financial, governance, structural) match `NOTIFICATION_TIERS` in `role-notifications.ts`.

---

## 4. AI and “messages as notifications”

### What uses AI (Groq)

| Feature | Module | When it runs | Without `GROQ_API_KEY` |
|--------|--------|----------------|-------------------------|
| Task / lead / meeting reminder copy | `ai-reminders.ts` | Reminder jobs (`task-reminders`, `lead-reminders`, etc.) | Falls back to static subject/body |
| Client project update text | `generateClientProjectMessage` | `POST /projects/:projectId/client-message` | **503** + `fallback` text in JSON |
| Curate / polish client-facing draft | `ai-reminders.ts` (curate) | If exposed via API | Returns null / errors handled per route |
| **AI alignment notifications** | `ai-alignment-notifications.ts` | **Background:** `GET /dashboard/attention` triggers `processAiAlignmentNotifications` (throttled) | No notifications created if `generateAlignment` returns null (no client) |

**Env:** `GROQ_API_KEY` required for any Groq call; `GROQ_REMINDER_MODEL` optional.

### In-app notifications that are AI-authored

- **Alignment:** Type `ai.alignment` (see `NOTIFICATION_TYPE` in `ai-alignment-notifications.ts`) — separate **subject/body per role** (sales, developer, director, admin) delivered as normal in-app notifications.

### What is *not* AI-generated

- Most operational notifications (task updated, timeline updated, director alerts, admin mirrors) use **fixed templates** in code, not LLM text.
- **Activity feed** (`/activity` or event logs) is not automatically rewritten by AI.

**Gap / expectation:** If the product goal is “every activity notification body is AI-drafted,” that is **not** implemented — only alignment + reminder copy + client message endpoint use the LLM today.

---

## 5. Known gaps and follow-ups

1. **Migrations:** CI/CD and local dev must run `prisma migrate deploy` (or `migrate dev`) so schema matches Prisma client.
2. **Finance invoice email:** **Fixed** — `POST /finance/invoices` loads `Client.email` for the org; if present, queues `Notification` with `to` set to that address and logs `logEmailSent` with the same recipient. If the client has no email, the invoice is still created but no queued email row is created.
3. **AI coverage:** Activity-level notifications are mostly template-based; expanding AI would require new prompts + rate limits + privacy review.
4. **E2E breadth:** `tests/api.test.ts` covers finance invoice email, `PATCH /account/me` notification preferences, `GET /notifications/me` with `muteAllInApp`, and sales `POST /projects` → `director.activity` notification. See `docs/DEV_SETUP.md` for DB and CI steps.

---

## 6. Conclusion

- **Tests and builds** succeed after DB migration alignment.
- **Sales → Director → Admin** notification behavior is consistent with the modular helpers described above; Admin gets visibility mirrors and finance escalations as designed.
- **Settings / account** paths match the API; tier keys are filtered on both client and server.
- **AI** drafts alignment notifications (when Groq is configured and dashboard attention runs) and optional client/sales copy; it does **not** draft all activity notifications.
