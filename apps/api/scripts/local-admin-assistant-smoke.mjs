#!/usr/bin/env node
/**
 * Smoke test for Admin + Finance AI Assistants (Phases 1–5).
 * Usage: node scripts/local-admin-assistant-smoke.mjs
 * Requires running API on PORT (default 4000).
 */
import request from "supertest";

const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4000";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || "admin@cresdynamics.com";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "Cres@Team2026#";
const financeEmail = process.env.SMOKE_FINANCE_EMAIL || "finance@cresdynamics.com";
const financePassword = process.env.SMOKE_FINANCE_PASSWORD || "Cres@Team2026#";

async function login(email, password) {
  const res = await request(baseUrl).post("/auth/login").send({ email, password });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  return res.body.accessToken;
}

async function main() {
  const adminToken = await login(adminEmail, adminPassword);
  const financeToken = await login(financeEmail, financePassword);

  const checks = [
    {
      name: "admin intelligence chat",
      run: () =>
        request(baseUrl)
          .post("/admin/assistant/chat")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ message: "Summarize active projects briefly", mode: "intelligence" })
    },
    {
      name: "admin execute parse",
      run: () =>
        request(baseUrl)
          .post("/admin/assistant/parse")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            message:
              "Next Monday at 10am meet the director. Assign Wilson 3 hours to review the ERP proposal."
          })
    },
    {
      name: "admin sessions",
      run: () =>
        request(baseUrl)
          .get("/admin/assistant/sessions?limit=3")
          .set("Authorization", `Bearer ${adminToken}`)
    },
    {
      name: "finance execute preview",
      run: () =>
        request(baseUrl)
          .post("/finance/assistant/chat")
          .set("Authorization", `Bearer ${financeToken}`)
          .send({ message: "Record 3000 KES transport for Wilson yesterday", mode: "execute" })
    },
    {
      name: "finance sessions",
      run: () =>
        request(baseUrl)
          .get("/finance/assistant/sessions?limit=3")
          .set("Authorization", `Bearer ${financeToken}`)
    }
  ];

  let failed = 0;
  for (const check of checks) {
    const res = await check.run();
    const ok =
      res.status === 200 &&
      (check.name.includes("sessions")
        ? Array.isArray(res.body.sessions)
        : typeof res.body.reply === "string" || res.body.sessions);
    console.log(
      ok ? "PASS" : "FAIL",
      check.name,
      `status=${res.status}`,
      check.name.includes("sessions")
        ? `count=${(res.body.sessions || []).length}`
        : `mode=${res.body.mode} actions=${(res.body.proposedActions || []).length}`
    );
    if (!ok) failed++;
  }

  const guards = [
    ["no token", () => request(baseUrl).post("/admin/assistant/chat").send({ message: "x" }), 401],
    [
      "empty message",
      () =>
        request(baseUrl)
          .post("/admin/assistant/chat")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ message: "", mode: "execute" }),
      400
    ],
    [
      "no audio",
      () =>
        request(baseUrl)
          .post("/admin/assistant/from-voice")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ mode: "intelligence" }),
      400
    ]
  ];
  for (const [name, run, expected] of guards) {
    const res = await run();
    const ok = res.status === expected;
    console.log(ok ? "PASS" : "FAIL", `guard ${name}`, `status=${res.status} (expected ${expected})`);
    if (!ok) failed++;
  }

  const health = await request(baseUrl).get("/health/ready");
  console.log(health.status === 200 ? "PASS" : "FAIL", "health/ready", health.body);

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
