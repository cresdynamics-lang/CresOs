"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { emitDataRefresh } from "../../data-refresh";
import { formatMoney } from "../../format-money";
import { WorkspaceDashboardIntro } from "../../../components/workspace-dashboard-intro";

type MonthDetail = {
  year: number;
  month: number;
  key: string;
  paid: boolean;
  paidAt: string | null;
  invoiceId: string | null;
};

type ManagementProject = {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
  clientId: string | null;
  managementMonthlyAmount: number;
  managementMonths: number | null;
  managementStartedAt: string | null;
  managementProgressPercent: number | null;
  monthDetails: MonthDetail[];
  pendingAmount: number;
  paidMonthsCount: number;
  totalBillableMonths: number;
};

type ApprovedOption = { id: string; name: string; approvalStatus?: string; managementActive?: boolean };

export default function ProjectsManagementPage() {
  const { apiFetch, auth, hydrated } = useAuth();
  const isDirector = auth.roleKeys.includes("director_admin");
  const isFinance = auth.roleKeys.includes("finance");
  const isAdmin = auth.roleKeys.includes("admin");
  const canView = isDirector || isFinance || isAdmin;
  const canFinanceActions = isFinance || isAdmin;

  const [rows, setRows] = useState<ManagementProject[]>([]);
  const [defaultMonthly, setDefaultMonthly] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [approvedList, setApprovedList] = useState<ApprovedOption[]>([]);
  const [enrollProjectId, setEnrollProjectId] = useState("");
  const [enrollMonthly, setEnrollMonthly] = useState("2000");
  const [enrollStarted, setEnrollStarted] = useState(() => new Date().toISOString().slice(0, 10));
  const [enrollMonths, setEnrollMonths] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    managementStartedAt: "",
    managementProgressPercent: "",
    managementMonthlyAmount: "",
    managementMonths: ""
  });
  const [invoiceBusy, setInvoiceBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hydrated || !auth.accessToken || !canView) return;
    setLoading(true);
    try {
      const res = await apiFetch("/projects/management");
      if (res.ok) {
        const data = (await res.json()) as {
          projects?: ManagementProject[];
          defaultMonthlyKes?: number;
        };
        setRows(Array.isArray(data.projects) ? data.projects : []);
        if (typeof data.defaultMonthlyKes === "number") setDefaultMonthly(data.defaultMonthlyKes);
      }
      if (isDirector) {
        const pr = await apiFetch("/projects");
        if (pr.ok) {
          const list = (await pr.json()) as ApprovedOption[];
          setApprovedList(
            list.filter((p) => p.approvalStatus === "approved" && !p.managementActive)
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, auth.accessToken, hydrated, canView, isDirector]);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollProjectId) return;
    setBusyId(enrollProjectId);
    try {
      const res = await apiFetch(`/projects/${enrollProjectId}/management/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managementMonthlyAmount: enrollMonthly.trim() ? Number(enrollMonthly) : undefined,
          managementStartedAt: enrollStarted || undefined,
          managementMonths: enrollMonths.trim() ? Number(enrollMonths) : undefined
        })
      });
      if (res.ok) {
        setEnrollProjectId("");
        setEnrollMonthly(String(defaultMonthly));
        await load();
        emitDataRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const removeManagement = async (projectId: string) => {
    if (!window.confirm("Remove this project from management billing? Month history for invoices will be deleted.")) return;
    setBusyId(projectId);
    try {
      const res = await apiFetch(`/projects/${projectId}/management`, { method: "DELETE" });
      if (res.ok) {
        setEditFor(null);
        await load();
        emitDataRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (projectId: string) => {
    setBusyId(projectId);
    try {
      const res = await apiFetch(`/projects/${projectId}/management`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managementStartedAt: editDraft.managementStartedAt || null,
          managementProgressPercent: editDraft.managementProgressPercent.trim()
            ? Number(editDraft.managementProgressPercent)
            : null,
          managementMonthlyAmount: editDraft.managementMonthlyAmount.trim()
            ? Number(editDraft.managementMonthlyAmount)
            : undefined,
          managementMonths: editDraft.managementMonths.trim()
            ? Number(editDraft.managementMonths)
            : null
        })
      });
      if (res.ok) {
        setEditFor(null);
        await load();
        emitDataRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const togglePaid = async (projectId: string, year: number, month: number, paid: boolean) => {
    if (!canFinanceActions) return;
    setBusyId(`${projectId}-${year}-${month}`);
    try {
      const res = await apiFetch(`/finance/projects/${projectId}/management-month`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, paid })
      });
      if (res.ok) {
        await load();
        emitDataRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const createInvoice = async (projectId: string, year: number, month: number) => {
    if (!canFinanceActions) return;
    const key = `${projectId}-inv-${year}-${month}`;
    setInvoiceBusy(key);
    try {
      const res = await apiFetch("/finance/invoices/management-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          year,
          month,
          issueDate: new Date().toISOString().slice(0, 10)
        })
      });
      if (res.ok) {
        await load();
        emitDataRefresh();
      }
    } finally {
      setInvoiceBusy(null);
    }
  };

  const openEdit = (p: ManagementProject) => {
    setEditFor(p.id);
    setEditDraft({
      managementStartedAt: p.managementStartedAt ? p.managementStartedAt.slice(0, 10) : "",
      managementProgressPercent:
        p.managementProgressPercent != null ? String(p.managementProgressPercent) : "",
      managementMonthlyAmount: String(p.managementMonthlyAmount),
      managementMonths: p.managementMonths != null ? String(p.managementMonths) : ""
    });
  };

  if (!hydrated) {
    return <section className="p-4 text-[#5B6472]">Loading…</section>;
  }

  if (!canView) {
    return (
      <section className="p-4">
        <p className="text-[#5B6472]">You don&apos;t have access to management billing.</p>
        <Link href="/projects" className="text-[#2563EB] hover:underline">
          Back to projects
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <WorkspaceDashboardIntro
        title="Projects on management"
        description="Monthly retainer tracking: directors enroll projects (default 2,000 KES/month, editable). Finance marks months paid and can issue invoices for unpaid periods. Figures update from live billing rules."
        eyebrow="Delivery"
        showWelcomeBanner={false}
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/projects" className="text-[#2563EB] hover:underline">
          ← All projects
        </Link>
        {canFinanceActions && (
          <Link href="/finance" className="text-[#2563EB] hover:underline">
            Finance overview
          </Link>
        )}
      </div>

      {isDirector && (
        <div className="shell border-sky-800/40 bg-white">
          <h3 className="text-sm font-semibold text-[#1A1D26]">Add project to management</h3>
          <p className="mt-1 text-xs text-[#5B6472]">
            Only approved projects. Default fee is {formatMoney(defaultMonthly)}/month until you change it.
          </p>
          <form onSubmit={enroll} className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
            <select
              value={enrollProjectId}
              onChange={(e) => setEnrollProjectId(e.target.value)}
              className="rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-2 text-sm text-[#1A1D26] md:min-w-[220px]"
              required
            >
              <option value="">Select approved project</option>
              {approvedList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex flex-col text-xs text-[#5B6472]">
              KES / month
              <input
                type="number"
                min={1}
                step={1}
                value={enrollMonthly}
                onChange={(e) => setEnrollMonthly(e.target.value)}
                className="mt-0.5 rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1.5 text-sm text-[#1A1D26]"
              />
            </label>
            <label className="flex flex-col text-xs text-[#5B6472]">
              Management started
              <input
                type="date"
                value={enrollStarted}
                onChange={(e) => setEnrollStarted(e.target.value)}
                className="mt-0.5 rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1.5 text-sm text-[#1A1D26]"
              />
            </label>
            <label className="flex flex-col text-xs text-[#5B6472]">
              Duration (months, optional)
              <input
                type="number"
                min={1}
                placeholder="Ongoing if empty"
                value={enrollMonths}
                onChange={(e) => setEnrollMonths(e.target.value)}
                className="mt-0.5 rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1.5 text-sm text-[#1A1D26]"
              />
            </label>
            <button
              type="submit"
              disabled={!!busyId}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Enroll
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-[#5B6472]">Loading management projects…</p>
      ) : rows.length === 0 ? (
        <p className="text-[#5B6472]">No projects on management yet.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((p) => (
            <li key={p.id} className="shell border-[#E5E9EF]/80">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/projects/${p.id}`} className="text-lg font-medium text-[#2563EB] hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs capitalize text-[#5B6472]">
                    {p.status}
                    {p.client?.name ? ` · Client: ${p.client.name}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-[#5B6472]">
                    {formatMoney(p.managementMonthlyAmount)}/month · Started{" "}
                    {p.managementStartedAt
                      ? new Date(p.managementStartedAt).toLocaleDateString()
                      : "—"}
                    {p.managementMonths != null ? ` · Planned ${p.managementMonths} month(s)` : " · Ongoing"}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-[#B45309]">Pending (unpaid months): {formatMoney(p.pendingAmount)}</span>
                    {" · "}
                    <span className="text-[#5B6472]">
                      Paid months: {p.paidMonthsCount}/{p.totalBillableMonths}
                    </span>
                  </p>
                  {p.managementProgressPercent != null && (
                    <div className="mt-2 max-w-md">
                      <div className="flex justify-between text-xs text-[#5B6472]">
                        <span>Director progress</span>
                        <span>{p.managementProgressPercent}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded bg-[#E5E9EF]">
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${Math.min(100, Math.max(0, p.managementProgressPercent))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {isDirector && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded border border-[#D0D5DD] px-3 py-1 text-xs text-[#1A1D26] hover:bg-[#E5E9EF]"
                      >
                        Edit / progress
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeManagement(p.id)}
                        disabled={busyId === p.id}
                        className="rounded border border-rose-700 px-3 py-1 text-xs text-[#C62828] hover:bg-[#FEF2F2] disabled:opacity-50"
                      >
                        Remove from management
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editFor === p.id && isDirector && (
                <div className="mt-4 rounded border border-[#E5E9EF] bg-[#F4F7F9] p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#5B6472]">Update management</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs text-[#5B6472]">
                      Started (date)
                      <input
                        type="date"
                        value={editDraft.managementStartedAt}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, managementStartedAt: e.target.value }))
                        }
                        className="mt-1 w-full rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1 text-sm text-[#1A1D26]"
                      />
                    </label>
                    <label className="text-xs text-[#5B6472]">
                      Progress %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editDraft.managementProgressPercent}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, managementProgressPercent: e.target.value }))
                        }
                        className="mt-1 w-full rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1 text-sm text-[#1A1D26]"
                      />
                    </label>
                    <label className="text-xs text-[#5B6472]">
                      KES / month
                      <input
                        type="number"
                        min={1}
                        value={editDraft.managementMonthlyAmount}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, managementMonthlyAmount: e.target.value }))
                        }
                        className="mt-1 w-full rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1 text-sm text-[#1A1D26]"
                      />
                    </label>
                    <label className="text-xs text-[#5B6472]">
                      Duration (months)
                      <input
                        type="number"
                        min={1}
                        placeholder="Empty = ongoing"
                        value={editDraft.managementMonths}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, managementMonths: e.target.value }))
                        }
                        className="mt-1 w-full rounded border border-[#D0D5DD] bg-[#E5E9EF] px-2 py-1 text-sm text-[#1A1D26]"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(p.id)}
                      disabled={busyId === p.id}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFor(null)}
                      className="rounded border border-[#D0D5DD] px-3 py-1 text-xs text-[#5B6472]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E9EF] text-xs uppercase tracking-wide text-[#5B6472]">
                      <th className="pb-2 pr-2">Month</th>
                      <th className="pb-2 pr-2">Status</th>
                      <th className="pb-2 pr-2">Paid</th>
                      <th className="pb-2 pr-2">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.monthDetails.map((m) => {
                      const b = `${p.id}-${m.year}-${m.month}`;
                      return (
                        <tr key={m.key} className="border-b border-[#E5E9EF]/80">
                          <td className="py-2 pr-2 text-[#1A1D26]">{m.key}</td>
                          <td className="py-2 pr-2">
                            {m.paid ? (
                              <span className="text-[#1B6B3A]">Paid</span>
                            ) : (
                              <span className="text-[#B45309]">Pending</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {canFinanceActions ? (
                              <label className="inline-flex items-center gap-2 text-xs text-[#5B6472]">
                                <input
                                  type="checkbox"
                                  checked={m.paid}
                                  disabled={busyId === b}
                                  onChange={(e) => void togglePaid(p.id, m.year, m.month, e.target.checked)}
                                />
                                Mark paid
                              </label>
                            ) : (
                              <span className="text-[#5B6472]">{m.paid ? "Yes" : "No"}</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {m.invoiceId ? (
                              <span className="text-xs text-[#5B6472]">Linked</span>
                            ) : !m.paid && canFinanceActions ? (
                              <button
                                type="button"
                                disabled={invoiceBusy === `${p.id}-inv-${m.year}-${m.month}`}
                                onClick={() => void createInvoice(p.id, m.year, m.month)}
                                className="rounded border border-sky-700 px-2 py-0.5 text-xs text-[#2563EB] hover:bg-[#F0F6FC] disabled:opacity-50"
                              >
                                Generate invoice
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
