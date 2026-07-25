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
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#2D5A5A]">
          Proposed actions
        </p>
        {onExecuteAll && anyPending ? (
          <button
            type="button"
            disabled={executing}
            onClick={onExecuteAll}
            className="rounded-lg bg-[#2D5A5A] px-3 py-1.5 font-label text-xs font-semibold text-white hover:bg-[#244848] disabled:opacity-50"
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
                  ? "border-[#A7D7B8] bg-[#E8F5EE] text-[#2E7D4F]"
                  : failed
                    ? "border-[#F5B5B5] bg-[#FEF2F2] text-[#C62828]"
                    : "border-[#E5E9EF] bg-[#F4F7F9] text-[#1A1D26]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[#2D5A5A]/30 bg-[#E8F0F0] px-2 py-0.5 font-label text-[10px] font-bold uppercase text-[#2D5A5A]">
                  {KIND_LABELS[a.kind]}
                </span>
                <span className="font-body font-semibold text-[#1A1D26]">{a.title}</span>
                {done ? (
                  <span className="font-label text-[10px] font-bold uppercase text-[#2E7D4F]">Created</span>
                ) : null}
                {done && result.scheduleItemId ? (
                  <a href="/schedule" className="font-label text-[10px] font-bold text-[#2E7D4F] hover:underline">
                    View schedule
                  </a>
                ) : null}
              </div>
              <dl className="mt-2 grid gap-1 font-body text-xs text-[#5B6472]">
                {a.scheduledAt ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">When: </dt>
                    <dd className="inline">{new Date(a.scheduledAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {a.dueDate ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">Due: </dt>
                    <dd className="inline">{new Date(a.dueDate).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                {a.assigneeHint ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">Person: </dt>
                    <dd className="inline">{a.assigneeHint}</dd>
                  </div>
                ) : null}
                {a.projectHint ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">Project: </dt>
                    <dd className="inline">{a.projectHint}</dd>
                  </div>
                ) : null}
                {a.estimatedHours != null ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">Est. hours: </dt>
                    <dd className="inline">{a.estimatedHours}</dd>
                  </div>
                ) : null}
                {result?.resolvedAssignee ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">Assigned: </dt>
                    <dd className="inline">{result.resolvedAssignee}</dd>
                  </div>
                ) : null}
                {result?.resolvedProject ? (
                  <div>
                    <dt className="inline text-[#8B93A1]">Project: </dt>
                    <dd className="inline">{result.resolvedProject}</dd>
                  </div>
                ) : null}
                {failed && result.error ? (
                  <div className="font-semibold text-[#C62828]">{result.error}</div>
                ) : null}
                {failed && result.candidates && result.candidates.length > 0 && onResolveCandidate ? (
                  <div className="mt-2">
                    <p className="font-label text-[10px] font-bold text-[#5B6472]">Pick {field}:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={executing}
                          onClick={() => onResolveCandidate(a, field, c.id)}
                          className="rounded-lg border border-[#2D5A5A]/30 bg-[#E8F0F0] px-2 py-1 font-label text-[10px] font-bold text-[#2D5A5A] hover:bg-[#2D5A5A] hover:text-white"
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
                  className="mt-3 rounded-lg border border-[#2D5A5A]/40 bg-white px-3 py-1.5 font-label text-xs font-semibold text-[#2D5A5A] hover:bg-[#E8F0F0]"
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
