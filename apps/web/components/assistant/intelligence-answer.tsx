"use client";

import Link from "next/link";
import { adminNeu } from "../admin/admin-theme";
import type { AdminAssistantResponse } from "./admin-assistant-types";

export function IntelligenceAnswer({ result }: { result: AdminAssistantResponse }) {
  return (
    <div className="space-y-4">
      {result.focus && result.focus !== "general" ? (
        <span className={adminNeu.badgeAccent}>Focus: {result.focus}</span>
      ) : null}
      <div
        className={`${adminNeu.panelInset} whitespace-pre-wrap font-body text-sm font-medium leading-relaxed text-[#1A1D26]`}
      >
        {result.reply}
      </div>

      {result.hoursInsights && result.hoursInsights.length > 0 ? (
        <div className="space-y-2">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#9A6B12]">
            Hours analysis
          </p>
          <ul className="space-y-2">
            {result.hoursInsights.map((h) => (
              <li key={h.subject} className={`${adminNeu.listRow} px-3 py-3`}>
                <p className="font-body text-sm font-semibold text-[#1A1D26]">{h.subject}</p>
                <p className="mt-1 font-body text-xs font-medium text-[#5B6472]">
                  {h.daysMentioned != null ? `${h.daysMentioned} day(s) mentioned` : null}
                  {h.estimatedHours != null ? ` · ~${h.estimatedHours}h estimated` : null}
                  {h.actualHours != null ? ` · ${h.actualHours}h actual` : null}
                </p>
                <p className="mt-1 font-body text-xs leading-relaxed text-[#5B6472]">{h.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.projectBriefs && result.projectBriefs.length > 0 ? (
        <div className="space-y-2">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#5B6472]">Projects</p>
          <ul className="space-y-2">
            {result.projectBriefs.map((p) => (
              <li key={p.projectId || p.projectName} className={`${adminNeu.listRow} px-3 py-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {p.projectId ? (
                    <Link
                      href={`/pm/projects/${p.projectId}`}
                      className="font-body text-sm font-semibold text-[#2D5A5A] hover:underline"
                    >
                      {p.projectName}
                    </Link>
                  ) : (
                    <span className="font-body text-sm font-semibold text-[#1A1D26]">{p.projectName}</span>
                  )}
                  <span className="font-label text-[10px] font-bold uppercase text-[#5B6472]">
                    {p.riskLevel} · {p.healthScore}/100
                  </span>
                </div>
                <p className="mt-1 font-body text-xs leading-relaxed text-[#5B6472]">{p.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.personInsights && result.personInsights.length > 0 ? (
        <div className="space-y-2">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-[#5B6472]">People</p>
          <ul className="space-y-2">
            {result.personInsights.map((p) => (
              <li key={p.personHint} className={`${adminNeu.listRow} px-3 py-3`}>
                <p className="font-body text-sm font-semibold text-[#1A1D26]">{p.personHint}</p>
                {(p.reportDaysLast30 != null || p.estimatedHours != null) && (
                  <p className="mt-0.5 font-body text-[11px] font-medium text-[#5B6472]">
                    {p.reportDaysLast30 != null ? `${p.reportDaysLast30} report days (30d)` : null}
                    {p.estimatedHours != null ? ` · ${p.estimatedHours}h est tasks` : null}
                    {p.actualHours != null ? ` · ${p.actualHours}h actual` : null}
                  </p>
                )}
                <p className="mt-1 font-body text-xs leading-relaxed text-[#5B6472]">{p.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
