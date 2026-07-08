"use client";

import Link from "next/link";
import { adminNeu } from "../admin/admin-theme";
import type { AdminAssistantResponse } from "./admin-assistant-types";

export function IntelligenceAnswer({ result }: { result: AdminAssistantResponse }) {
  return (
    <div className="space-y-4">
      {result.focus && result.focus !== "general" ? (
        <span className="inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
          Focus: {result.focus}
        </span>
      ) : null}
      <div className={`${adminNeu.panelInset} whitespace-pre-wrap text-sm leading-relaxed text-slate-200`}>
        {result.reply}
      </div>

      {result.hoursInsights && result.hoursInsights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">Hours analysis</p>
          <ul className="space-y-2">
            {result.hoursInsights.map((h) => (
              <li key={h.subject} className={`${adminNeu.listRow} px-3 py-3`}>
                <p className="text-sm font-medium text-slate-100">{h.subject}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {h.daysMentioned != null ? `${h.daysMentioned} day(s) mentioned` : null}
                  {h.estimatedHours != null ? ` · ~${h.estimatedHours}h estimated` : null}
                  {h.actualHours != null ? ` · ${h.actualHours}h actual` : null}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{h.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.projectBriefs && result.projectBriefs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Projects</p>
          <ul className="space-y-2">
            {result.projectBriefs.map((p) => (
              <li key={p.projectId || p.projectName} className={`${adminNeu.listRow} px-3 py-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {p.projectId ? (
                    <Link
                      href={`/pm/projects/${p.projectId}`}
                      className="text-sm font-medium text-indigo-200 hover:underline"
                    >
                      {p.projectName}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-slate-100">{p.projectName}</span>
                  )}
                  <span className="text-[10px] uppercase text-slate-500">
                    {p.riskLevel} · {p.healthScore}/100
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.personInsights && result.personInsights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">People</p>
          <ul className="space-y-2">
            {result.personInsights.map((p) => (
              <li key={p.personHint} className={`${adminNeu.listRow} px-3 py-3`}>
                <p className="text-sm font-medium text-slate-100">{p.personHint}</p>
                {(p.reportDaysLast30 != null || p.estimatedHours != null) && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {p.reportDaysLast30 != null ? `${p.reportDaysLast30} report days (30d)` : null}
                    {p.estimatedHours != null ? ` · ${p.estimatedHours}h est tasks` : null}
                    {p.actualHours != null ? ` · ${p.actualHours}h actual` : null}
                  </p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
