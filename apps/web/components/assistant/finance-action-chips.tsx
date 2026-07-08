"use client";

import type { FinanceExecutedAction, FinanceProposedAction } from "./finance-assistant-types";
import { formatFinanceImpactPreview } from "./finance-assistant-types";

const KIND_LABELS: Record<FinanceProposedAction["kind"], string> = {
  create_expense: "Expense",
  create_payment: "Payment"
};

type Props = {
  actions: FinanceProposedAction[];
  executing?: boolean;
  executionResults?: FinanceExecutedAction[];
  onExecuteAll?: () => void;
  onExecuteOne?: (action: FinanceProposedAction) => void;
};

function resultFor(actionId: string, results?: FinanceExecutedAction[]) {
  return results?.find((r) => r.actionId === actionId);
}

export function FinanceActionChips({
  actions,
  executing,
  executionResults,
  onExecuteAll,
  onExecuteOne
}: Props) {
  if (actions.length === 0) return null;
  const anyPending = actions.some((a) => !resultFor(a.id, executionResults)?.success);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
          Proposed finance actions
        </p>
        {onExecuteAll && anyPending ? (
          <button
            type="button"
            disabled={executing}
            onClick={onExecuteAll}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {executing ? "Recording…" : "Record all"}
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {actions.map((a) => {
          const result = resultFor(a.id, executionResults);
          const done = result?.success;
          const failed = result && !result.success;
          return (
            <li
              key={a.id}
              className={`rounded-xl border px-4 py-3 text-sm ${
                done
                  ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                  : failed
                    ? "border-rose-500/30 bg-rose-500/[0.06]"
                    : "border-emerald-500/20 bg-emerald-500/[0.04]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                  {KIND_LABELS[a.kind]}
                </span>
                <span className="font-medium text-slate-100">{a.title}</span>
                {a.amount != null ? (
                  <span className="text-xs text-slate-400">
                    {a.amount.toLocaleString()} {a.currency ?? "KES"}
                  </span>
                ) : null}
              </div>
              <dl className="mt-2 grid gap-1 text-xs text-slate-400">
                {a.category ? (
                  <div>
                    <dt className="inline text-slate-500">Category: </dt>
                    <dd className="inline">{a.category}</dd>
                  </div>
                ) : null}
                {a.method ? (
                  <div>
                    <dt className="inline text-slate-500">Method: </dt>
                    <dd className="inline">{a.method}</dd>
                  </div>
                ) : null}
                {a.beneficiaryHint ? (
                  <div>
                    <dt className="inline text-slate-500">Beneficiary: </dt>
                    <dd className="inline">{a.beneficiaryHint}</dd>
                  </div>
                ) : null}
                {a.invoiceHint ? (
                  <div>
                    <dt className="inline text-slate-500">Invoice: </dt>
                    <dd className="inline">{a.invoiceHint}</dd>
                  </div>
                ) : null}
                {a.projectHint ? (
                  <div>
                    <dt className="inline text-slate-500">Project: </dt>
                    <dd className="inline">{a.projectHint}</dd>
                  </div>
                ) : null}
                {a.impactPreview
                  ? formatFinanceImpactPreview(a.impactPreview).map((line) => (
                      <div key={line} className="text-emerald-300/90">
                        {line}
                      </div>
                    ))
                  : null}
                {failed && result.error ? <div className="text-rose-300">{result.error}</div> : null}
              </dl>
              {onExecuteOne && !done && !executing ? (
                <button
                  type="button"
                  onClick={() => onExecuteOne(a)}
                  className="mt-3 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
                >
                  Record
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
