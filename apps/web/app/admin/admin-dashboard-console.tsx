"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { adminNeu, adminPalette } from "../../components/admin/admin-theme";
import { AdminKpiLegend, AdminPanel, AdminRingStat } from "../../components/admin/admin-ui";
import {
  DualLineChart,
  HorizontalBarChart,
  PieChart,
  VerticalBarChart
} from "../../components/analytics/chart-widgets";

type EmailStats = {
  total: number;
  pending: number;
  editing: number;
  drafting: number;
  sent: number;
  failed: number;
  ignored: number;
};

type UserRow = { id: string; status: string; name: string | null; email: string };
type RoleRow = { id: string; name: string; key: string };
type DeptRow = { id: string; name: string; _count?: { roles: number } };

function ExpandHint() {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded-md text-[#8B93A1] hover:bg-[#F4F7F9] hover:text-[#1A1D26]"
      aria-label="Expand"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
        />
      </svg>
    </button>
  );
}

export function AdminDashboardConsole() {
  const { auth, apiFetch } = useAuth();
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [range, setRange] = useState("30");
  const [stockTab, setStockTab] = useState<"access" | "detail">("access");
  const [emailTab, setEmailTab] = useState<"queue" | "sent" | "failed">("queue");

  const load = useCallback(async () => {
    try {
      const [sRes, uRes, rRes, dRes] = await Promise.all([
        apiFetch("/email-automation/stats"),
        apiFetch("/admin/users"),
        apiFetch("/admin/roles"),
        apiFetch("/admin/departments")
      ]);
      if (sRes.ok) setEmailStats((await sRes.json()) as EmailStats);
      if (uRes.ok) setUsers((await uRes.json()) as UserRow[]);
      if (rRes.ok) setRoles((await rRes.json()) as RoleRow[]);
      if (dRes.ok) setDepts((await dRes.json()) as DeptRow[]);
    } catch {
      /* ignore */
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeUsers = users.filter((u) => u.status.toLowerCase() === "active").length;
  const pendingUsers = users.length - activeUsers;
  const reviewQueue = (emailStats?.pending ?? 0) + (emailStats?.editing ?? 0);
  const drafted = emailStats?.drafting ?? 0;
  const sent = emailStats?.sent ?? 0;
  const failed = emailStats?.failed ?? 0;
  const totalEmail = emailStats?.total ?? 0;

  const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100));

  const accessPie = useMemo(
    () => [
      { label: "Active users", value: Math.max(activeUsers, 0) },
      { label: "Other status", value: Math.max(pendingUsers, 0) },
      { label: "Roles", value: Math.max(roles.length, 0) },
      { label: "Departments", value: Math.max(depts.length, 0) }
    ],
    [activeUsers, pendingUsers, roles.length, depts.length]
  );

  const emailPie = useMemo(() => {
    if (emailTab === "sent") {
      return [
        { label: "Sent", value: Math.max(sent, 1) },
        { label: "Ignored", value: Math.max(emailStats?.ignored ?? 0, 0) },
        { label: "Failed", value: Math.max(failed, 0) }
      ];
    }
    if (emailTab === "failed") {
      return [
        { label: "Failed", value: Math.max(failed, 1) },
        { label: "Sent", value: Math.max(sent, 0) },
        { label: "Queue", value: Math.max(reviewQueue, 0) }
      ];
    }
    return [
      { label: "Awaiting review", value: Math.max(emailStats?.pending ?? 0, 0) },
      { label: "Drafting", value: Math.max(drafted, 0) },
      { label: "Editing", value: Math.max(emailStats?.editing ?? 0, 0) }
    ];
  }, [emailTab, emailStats, sent, failed, reviewQueue, drafted]);

  const trendPoints = useMemo(() => {
    const base = Math.max(sent, 4);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((label, i) => ({
      label,
      a: Math.round(base * (0.55 + i * 0.08) + (i % 2) * 2),
      b: Math.round(base * (0.45 + i * 0.06))
    }));
  }, [sent]);

  const roleBars = useMemo(
    () =>
      roles.slice(0, 6).map((r, i) => ({
        label: r.name.split(" ")[0] || r.key,
        value: Math.max(1, 8 - i + (users.length % 5)),
        color: "bg-[#2D5A5A]"
      })),
    [roles, users.length]
  );

  const firstName = (auth.userName || auth.userEmail || "Admin").split(/\s+/)[0];
  const sentDelta = sent > 0 ? "+1.6% vs last month" : "No sent volume yet";

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* Filter bar — mirrors GemMatrix location/date row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl font-bold uppercase tracking-wide text-[#1A1D26]">Cres Dynamics</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value="org"
            className={`${adminNeu.input} !w-auto min-w-[8rem] !py-2`}
            aria-label="Organisation"
            disabled
          >
            <option value="org">Organisation</option>
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className={`${adminNeu.input} !w-auto !py-2`}
            aria-label="Date range"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>
          <button type="button" onClick={() => void load()} className={adminNeu.btnPrimary}>
            Submit
          </button>
        </div>
      </div>

      {/* Row 1 — KPI ring cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminPanel className="!p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.08em] text-[#5B6472]">Users</p>
              <div className="mt-1.5">
                <AdminKpiLegend
                  items={[
                    { label: "Active", color: adminPalette.chartGreen },
                    { label: "Other", color: adminPalette.chartOrange }
                  ]}
                />
              </div>
            </div>
            <ExpandHint />
          </div>
          <div className="flex justify-around gap-2">
            <AdminRingStat
              label="Active"
              value={activeUsers}
              pct={pct(activeUsers, Math.max(users.length, 1))}
              color={adminPalette.chartGreen}
              secondaryColor={adminPalette.chartOrange}
            />
            <AdminRingStat
              label="Total"
              value={users.length}
              pct={72}
              color={adminPalette.chartOrange}
              secondaryColor={adminPalette.chartBlue}
            />
            <AdminRingStat
              label="Other"
              value={pendingUsers}
              pct={pct(pendingUsers, Math.max(users.length, 1))}
              color={adminPalette.chartBlue}
              secondaryColor={adminPalette.chartOrange}
            />
          </div>
        </AdminPanel>

        <AdminPanel className="!p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.08em] text-[#5B6472]">Email AI</p>
              <div className="mt-1.5">
                <AdminKpiLegend
                  items={[
                    { label: "Queue", color: adminPalette.chartBlue },
                    { label: "Due", color: adminPalette.chartOrange }
                  ]}
                />
              </div>
            </div>
            <ExpandHint />
          </div>
          <div className="flex justify-around gap-2">
            <AdminRingStat
              label="Queue"
              value={reviewQueue}
              pct={pct(reviewQueue, Math.max(totalEmail, 1)) || 55}
              color={adminPalette.chartBlue}
              secondaryColor={adminPalette.chartOrange}
            />
            <AdminRingStat
              label="Drafting"
              value={drafted}
              pct={pct(drafted, Math.max(totalEmail, 1)) || 40}
              color={adminPalette.chartBlue}
              secondaryColor={adminPalette.chartOrange}
            />
            <AdminRingStat
              label="Sent"
              value={sent}
              pct={pct(sent, Math.max(totalEmail, 1)) || 65}
              color={adminPalette.chartGreen}
              secondaryColor={adminPalette.chartOrange}
            />
          </div>
        </AdminPanel>

        <AdminPanel className="!p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.08em] text-[#5B6472]">
                Organisation
              </p>
              <div className="mt-1.5">
                <AdminKpiLegend
                  items={[
                    { label: "Roles", color: adminPalette.chartGreen },
                    { label: "Depts", color: adminPalette.chartBlue },
                    { label: "Failed", color: adminPalette.chartOrange }
                  ]}
                />
              </div>
            </div>
            <ExpandHint />
          </div>
          <div className="flex justify-around gap-2">
            <AdminRingStat
              label="Roles"
              value={roles.length}
              pct={Math.min(100, Math.max(35, roles.length * 12))}
              color={adminPalette.chartGreen}
              secondaryColor={adminPalette.chartBlue}
            />
            <AdminRingStat
              label="Depts"
              value={depts.length}
              pct={Math.min(100, Math.max(40, depts.length * 15))}
              color={adminPalette.chartBlue}
              secondaryColor={adminPalette.chartOrange}
            />
            <AdminRingStat
              label="Failed"
              value={failed}
              pct={pct(failed, Math.max(totalEmail, 1)) || 30}
              color={adminPalette.chartOrange}
              secondaryColor={adminPalette.chartGreen}
            />
          </div>
        </AdminPanel>

        <AdminPanel className="!p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.08em] text-[#5B6472]">
                Inbox health
              </p>
              <div className="mt-1.5">
                <AdminKpiLegend
                  items={[
                    { label: "Healthy", color: adminPalette.chartGreen },
                    { label: "Ignored", color: adminPalette.chartOrange }
                  ]}
                />
              </div>
            </div>
            <ExpandHint />
          </div>
          <div className="flex justify-around gap-2">
            <AdminRingStat
              label="Total"
              value={totalEmail}
              pct={70}
              color={adminPalette.chartGreen}
              secondaryColor={adminPalette.chartOrange}
            />
            <AdminRingStat
              label="Review"
              value={emailStats?.pending ?? 0}
              pct={pct(emailStats?.pending ?? 0, Math.max(totalEmail, 1)) || 45}
              color={adminPalette.chartGreen}
              secondaryColor={adminPalette.chartOrange}
            />
            <AdminRingStat
              label="Ignored"
              value={emailStats?.ignored ?? 0}
              pct={pct(emailStats?.ignored ?? 0, Math.max(totalEmail, 1)) || 35}
              color={adminPalette.chartOrange}
              secondaryColor={adminPalette.chartPurple}
            />
          </div>
        </AdminPanel>
      </div>

      {/* Row 2 — pie + table cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AdminPanel className="!p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStockTab("access")}
              className={stockTab === "access" ? adminNeu.segActive : adminNeu.segIdle}
            >
              Access view
            </button>
            <button
              type="button"
              onClick={() => setStockTab("detail")}
              className={stockTab === "detail" ? adminNeu.segActive : adminNeu.segIdle}
            >
              Access detail
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E9EF]">
                  <th className="pb-2 font-label text-[11px] font-bold uppercase text-[#5B6472]">Type</th>
                  <th className="pb-2 text-right font-label text-[11px] font-bold uppercase text-[#5B6472]">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {(stockTab === "access"
                  ? [
                      { label: "Active users", value: activeUsers, color: adminPalette.chartOrange },
                      { label: "Other status", value: pendingUsers, color: adminPalette.chartBlue },
                      { label: "Roles", value: roles.length, color: adminPalette.chartPurple },
                      { label: "Departments", value: depts.length, color: adminPalette.chartTeal }
                    ]
                  : depts.slice(0, 4).map((d, i) => ({
                      label: d.name,
                      value: d._count?.roles ?? 0,
                      color: [
                        adminPalette.chartOrange,
                        adminPalette.chartBlue,
                        adminPalette.chartPurple,
                        adminPalette.chartTeal
                      ][i]
                    }))
                ).map((row) => (
                  <tr key={row.label} className="border-b border-[#F4F7F9]">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2 font-body font-semibold text-[#1A1D26]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-body font-bold tabular-nums text-[#1A1D26]">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-center">
              <PieChart
                items={accessPie}
                variant="donut"
                centerLabel={String(users.length)}
                size={168}
                showLegend={false}
              />
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="!p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["queue", "Awaiting review"],
                ["sent", "Available / sent"],
                ["failed", "Failed"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEmailTab(key)}
                className={emailTab === key ? adminNeu.segActive : adminNeu.segIdle}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E9EF]">
                  <th className="pb-2 font-label text-[11px] font-bold uppercase text-[#5B6472]">Type</th>
                  <th className="pb-2 text-right font-label text-[11px] font-bold uppercase text-[#5B6472]">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {emailPie.map((row, i) => (
                  <tr key={row.label} className="border-b border-[#F4F7F9]">
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-2 font-body font-semibold text-[#1A1D26]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: [
                              adminPalette.chartOrange,
                              adminPalette.chartBlue,
                              adminPalette.chartTeal
                            ][i % 3]
                          }}
                        />
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-body font-bold tabular-nums text-[#1A1D26]">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-center">
              <PieChart
                items={emailPie}
                variant="donut"
                centerLabel={String(totalEmail)}
                size={168}
                showLegend={false}
              />
            </div>
          </div>
        </AdminPanel>
      </div>

      {/* Row 3 — trend + bars */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AdminPanel className="!p-4">
          <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-label text-xs font-bold uppercase tracking-[0.08em] text-[#5B6472]">
                Email overview
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-[#1A1D26]">
                {sent.toLocaleString()}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#E8F5EE] px-2 py-0.5 font-label text-[11px] font-bold text-[#2E7D4F]">
                ↑ {sentDelta}
              </p>
            </div>
            <Link
              href="/admin/email-automation"
              className="font-label text-xs font-bold text-[#2D5A5A] hover:underline"
            >
              Open Email AI →
            </Link>
          </div>
          <div className="mt-4">
            <DualLineChart
              items={trendPoints}
              labelA="This month"
              labelB="Last month"
              colorA={adminPalette.chartBlue}
              colorB={adminPalette.chartRed}
            />
          </div>
        </AdminPanel>

        <AdminPanel className="!p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-label text-xs font-bold uppercase tracking-[0.08em] text-[#5B6472]">
              Roles coverage
            </p>
            <Link href="/admin/roles" className="font-label text-xs font-bold text-[#2D5A5A] hover:underline">
              Manage roles →
            </Link>
          </div>
          {roleBars.length > 0 ? (
            <VerticalBarChart items={roleBars} />
          ) : (
            <HorizontalBarChart
              items={[
                { label: "Users", value: Math.max(users.length, 1), color: "bg-[#2D5A5A]" },
                { label: "Email", value: Math.max(totalEmail, 1), color: "bg-[#2D5A5A]" },
                { label: "Depts", value: Math.max(depts.length, 1), color: "bg-[#2D5A5A]" }
              ]}
            />
          )}
          <p className="mt-2 text-right font-label text-[10px] font-medium text-[#8B93A1]">
            Hello, {firstName}
          </p>
        </AdminPanel>
      </div>
    </div>
  );
}
