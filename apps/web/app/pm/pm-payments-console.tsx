"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmDataBlock, PmFullscreenPage, PmKpiBand, PmKpiCell, PmPageHero } from "../../components/pm/pm-shell";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";

type PaymentsPayload = {
  monthlySalary: number | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  payouts: { id: string; amount: number; status: string; createdAt: string; paidAt: string | null }[];
};

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function PmPaymentsConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const [data, setData] = useState<PaymentsPayload | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/pm/payments");
    if (res.ok) setData((await res.json()) as PaymentsPayload);
  }, [apiFetch]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  if (!canAccess) return null;

  const paidTotal = (data?.payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Payments"
        title="Your compensation"
        description="Monthly outlook and payout history for project management staff."
        backHref="/pm"
      />

      {data ? (
        <PmKpiBand cols={3}>
          <PmKpiCell
            label="Monthly salary"
            value={data.monthlySalary != null ? formatKes(data.monthlySalary) : "—"}
            hint={data.jobTitle ?? undefined}
          />
          <PmKpiCell label="Employment" value={data.employmentType ?? "—"} tone="emerald" />
          <PmKpiCell label="Paid to date" value={formatKes(paidTotal)} tone="amber" />
        </PmKpiBand>
      ) : null}

      <PmDataBlock>
        {(data?.payouts ?? []).length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">No payouts recorded yet.</p>
        ) : (
          data!.payouts.map((p) => (
            <div key={p.id} className={`${pmNeu.listRow} flex justify-between gap-2`}>
              <div>
                <p className="text-sm font-medium text-slate-100">{formatKes(p.amount)}</p>
                <p className="text-xs text-slate-500">
                  {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                </p>
              </div>
              {p.paidAt ? (
                <span className="text-xs text-emerald-400">
                  Paid {new Date(p.paidAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          ))
        )}
      </PmDataBlock>
    </PmFullscreenPage>
  );
}
