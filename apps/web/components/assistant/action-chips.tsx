"use client";

import type { ProposedAction } from "./admin-assistant-types";

const KIND_LABELS: Record<ProposedAction["kind"], string> = {
  schedule_meeting: "Meeting",
  create_task: "Task",
  create_project_task: "Project task"
};

export function ActionChips({ actions }: { actions: ProposedAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-400">
        Proposed actions (preview — Phase 2 will execute)
      </p>
      <ul className="space-y-2">
        {actions.map((a) => (
          <li
            key={a.id}
            className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3 text-sm text-slate-200"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-200">
                {KIND_LABELS[a.kind]}
              </span>
              <span className="font-medium text-slate-100">{a.title}</span>
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
              {a.notes ? (
                <div>
                  <dt className="inline text-slate-500">Notes: </dt>
                  <dd className="inline">{a.notes}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
