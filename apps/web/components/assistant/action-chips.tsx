"use client";

import type { ExecutedActionResult, ProposedAction } from "./admin-assistant-types";

const KIND_LABELS: Record<ProposedAction["kind"], string> = {
  schedule_meeting: "Meeting",
  create_task: "Task",
  create_project_task: "Project task"
};

type ActionChipsProps = {
  actions: ProposedAction[];
  executing?: boolean;
  executionResults?: ExecutedActionResult[];
  onExecuteAll?: () => void;
  onExecuteOne?: (action: ProposedAction) => void;
  onResolveCandidate?: (
    action: ProposedAction,
    field: "assignee" | "project",
    candidateId: string
  ) => void;
};

function resultFor(actionId: string, results?: ExecutedActionResult[]) {
  return results?.find((r) => r.actionId === actionId);
}

function needsProject(action: ProposedAction) {
  return action.kind === "create_project_task";
}

export function ActionChips({
  actions,
  executing,
  executionResults,
  onExecuteAll,
  onExecuteOne,
  onResolveCandidate
}: ActionChipsProps) {
  if (actions.length === 0) return null;

  const anyPending = actions.some((a) => !resultFor(a.id, executionResults)?.success);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
          Proposed actions
        </p>
        {onExecuteAll && anyPending ? (
          <button
            type="button"
            disabled={executing}
            onClick={onExecuteAll}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {executing ? "Executing…" : "Execute all"}
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {actions.map((a) => {
          const result = resultFor(a.id, executionResults);
          const done = result?.success;
          const failed = result && !result.success;
          const field = needsProject(a) ? "project" : "assignee";
          return (
            <li
              key={a.id}
              className={`rounded-xl border px-4 py-3 text-sm ${
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : failed
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-brand/20 bg-brand/5 text-slate-700"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
                  {KIND_LABELS[a.kind]}
                </span>
                <span className="font-medium text-slate-900">{a.title}</span>
                {done ? (
                  <span className="text-[10px] font-semibold uppercase text-emerald-700">Created</span>
                ) : null}
                {done && result.scheduleItemId ? (
                  <a href="/schedule" className="text-[10px] text-emerald-700 hover:underline">
                    View schedule
                  </a>
                ) : null}
              </div>
              <dl className="mt-2 grid gap-1 text-xs text-slate-400">
                {a.scheduledAt ? (
                  <div>
                    <dt className="inline text-slate-500">When: </dt>
                    <dd className="inline">{new Date(a.scheduledAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {a.dueDate ? (
                  <div>
                    <dt className="inline text-slate-500">Due: </dt>
                    <dd className="inline">{new Date(a.dueDate).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                {a.assigneeHint ? (
                  <div>
                    <dt className="inline text-slate-500">Person: </dt>
                    <dd className="inline">{a.assigneeHint}</dd>
                  </div>
                ) : null}
                {a.projectHint ? (
                  <div>
                    <dt className="inline text-slate-500">Project: </dt>
                    <dd className="inline">{a.projectHint}</dd>
                  </div>
                ) : null}
                {a.estimatedHours != null ? (
                  <div>
                    <dt className="inline text-slate-500">Est. hours: </dt>
                    <dd className="inline">{a.estimatedHours}</dd>
                  </div>
                ) : null}
                {result?.resolvedAssignee ? (
                  <div>
                    <dt className="inline text-slate-500">Assigned: </dt>
                    <dd className="inline">{result.resolvedAssignee}</dd>
                  </div>
                ) : null}
                {result?.resolvedProject ? (
                  <div>
                    <dt className="inline text-slate-500">Project: </dt>
                    <dd className="inline">{result.resolvedProject}</dd>
                  </div>
                ) : null}
                {failed && result.error ? (
                  <div className="text-rose-300">{result.error}</div>
                ) : null}
                {failed && result.candidates && result.candidates.length > 0 && onResolveCandidate ? (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500">Pick {field}:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={executing}
                          onClick={() => onResolveCandidate(a, field, c.id)}
                          className="rounded-lg border border-indigo-500/40 bg-brand/10 px-2 py-1 text-[10px] text-brand hover:bg-brand/10"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </dl>
              {onExecuteOne && !done && !executing ? (
                <button
                  type="button"
                  onClick={() => onExecuteOne(a)}
                  className="mt-3 rounded-lg border border-indigo-500/40 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10"
                >
                  Execute
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
