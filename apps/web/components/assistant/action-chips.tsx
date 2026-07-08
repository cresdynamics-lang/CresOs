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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-400">
          Proposed actions
        </p>
        {onExecuteAll && anyPending ? (
          <button
            type="button"
            disabled={executing}
            onClick={onExecuteAll}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
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
                  ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100"
                  : failed
                    ? "border-rose-500/30 bg-rose-500/[0.06] text-rose-100"
                    : "border-indigo-500/20 bg-indigo-500/[0.06] text-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-200">
                  {KIND_LABELS[a.kind]}
                </span>
                <span className="font-medium text-slate-100">{a.title}</span>
                {done ? (
                  <span className="text-[10px] font-semibold uppercase text-emerald-400">Created</span>
                ) : null}
                {done && result.scheduleItemId ? (
                  <a href="/schedule" className="text-[10px] text-emerald-300 hover:underline">
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
                          className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-100 hover:bg-indigo-500/20"
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
                  className="mt-3 rounded-lg border border-indigo-500/40 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/10"
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
