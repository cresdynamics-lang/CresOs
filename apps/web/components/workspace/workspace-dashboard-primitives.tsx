"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardSectionLabel } from "../dashboard-welcome-banner";

export type WorkspaceUrgencyTone = "danger" | "warning" | "info";

export type WorkspacePriorityItem = {
  id: string;
  tone: WorkspaceUrgencyTone;
  title: string;
  detail: string;
  href: string;
  action: string;
};

type WorkspaceDashboardSectionProps = {
  label: string;
  children: ReactNode;
  roleKeys?: string[];
  tone?: "priorities" | "focus" | "dashboard";
  className?: string;
};

export function WorkspaceDashboardSection({
  label,
  children,
  roleKeys = [],
  tone = "priorities",
  className = ""
}: WorkspaceDashboardSectionProps) {
  return (
    <section className={`w-full ${className}`.trim()}>
      <DashboardSectionLabel roleKeys={roleKeys} tone={tone}>
        {label}
      </DashboardSectionLabel>
      {children}
    </section>
  );
}

const URGENCY_TITLE: Record<WorkspaceUrgencyTone, string> = {
  danger: "font-display text-lg font-bold leading-snug tracking-tight text-rose-100 sm:text-xl",
  warning: "font-display text-base font-semibold leading-snug tracking-tight text-amber-100 sm:text-lg",
  info: "font-display text-base font-semibold leading-snug text-slate-100"
};

const URGENCY_ACTION: Record<WorkspaceUrgencyTone, string> = {
  danger: "bg-rose-600/95 text-white hover:bg-rose-500 shadow-[0_4px_14px_rgba(244,63,94,0.35)]",
  warning: "bg-amber-600/95 text-white hover:bg-amber-500 shadow-[0_4px_14px_rgba(245,158,11,0.3)]",
  info: "bg-sky-600/95 text-white hover:bg-sky-500"
};

type WorkspacePriorityGridProps = {
  items: WorkspacePriorityItem[];
  panelClass: (tone: WorkspaceUrgencyTone) => string;
  dismissible?: (id: string) => ReactNode;
};

export function WorkspacePriorityGrid({ items, panelClass, dismissible }: WorkspacePriorityGridProps) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 grid w-full gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className={panelClass(item.tone)}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-4">
            <div className="min-w-0 flex-1">
              <p className={URGENCY_TITLE[item.tone]}>{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{item.detail}</p>
              {dismissible?.(item.id)}
            </div>
            <Link
              href={item.href}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide sm:text-sm ${URGENCY_ACTION[item.tone]}`}
            >
              {item.action} →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

type WorkspaceAlignedTipsProps = {
  tips: string[];
  aiHint?: string | null;
  panelClass: string;
  roleKeys?: string[];
};

export function WorkspaceAlignedTips({ tips, aiHint, panelClass, roleKeys = [] }: WorkspaceAlignedTipsProps) {
  if (tips.length === 0 && !aiHint) return null;
  return (
    <WorkspaceDashboardSection label="Stay aligned" roleKeys={roleKeys} tone="focus">
      <div className={`mt-0 ${panelClass}`}>
        {tips.length > 0 ? (
          <ul className="space-y-2.5">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                <span className="mt-0.5 shrink-0 text-amber-500/90" aria-hidden>
                  •
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {aiHint ? (
          <p
            className={`text-sm leading-relaxed text-violet-200/90 ${tips.length > 0 ? "mt-4 border-t border-white/[0.06] pt-4" : ""}`}
          >
            {aiHint}
          </p>
        ) : null}
      </div>
    </WorkspaceDashboardSection>
  );
}

function normalizeCopy(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop focus-coach bullets already covered by Today's priorities alerts. */
export function dedupeFocusTips(
  tips: string[],
  opts: {
    reportReminderDue?: boolean;
    overdueReportQuestions?: number;
    hasUnreadAlert?: boolean;
    hasOutstandingInvoiceAlert?: boolean;
    hasOverdueInvoiceAlert?: boolean;
    hasOverdueTasksAlert?: boolean;
    hasPendingApprovalsAlert?: boolean;
    hasPendingPaymentsAlert?: boolean;
    priorityTitles?: string[];
  }
): string[] {
  const titleNorms = (opts.priorityTitles ?? []).map(normalizeCopy);
  return tips.filter((tip) => {
    const n = normalizeCopy(tip);
    if (opts.reportReminderDue && /submit.*report|sales report|developer report|today's sales report/.test(n)) {
      return false;
    }
    if ((opts.overdueReportQuestions ?? 0) > 0 && /question.*report|reports need a reply|report question/.test(n)) {
      return false;
    }
    if (opts.hasUnreadAlert && /unread.*notification/.test(n)) {
      return false;
    }
    if (opts.hasOverdueInvoiceAlert && /overdue invoice/.test(n)) {
      return false;
    }
    if (opts.hasOutstandingInvoiceAlert && /open invoice/.test(n)) {
      return false;
    }
    if (opts.hasOverdueTasksAlert && /overdue task/.test(n)) {
      return false;
    }
    if (opts.hasPendingApprovalsAlert && /approval.*need|approvals? in queue|approval record/.test(n)) {
      return false;
    }
    if (opts.hasPendingPaymentsAlert && /payment.*await|confirm.*payment|payments pending/.test(n)) {
      return false;
    }
    for (const title of titleNorms) {
      if (title.length > 12 && (n.includes(title.slice(0, 24)) || title.includes(n.slice(0, 24)))) {
        return false;
      }
    }
    return true;
  });
}

export function dedupeAiHint(
  hint: string | null,
  tips: string[],
  opts: { reportReminderDue?: boolean }
): string | null {
  if (!hint?.trim()) return null;
  const n = normalizeCopy(hint);
  if (opts.reportReminderDue && /submit.*report|sales report|file.*report/.test(n)) return null;
  for (const tip of tips) {
    const t = normalizeCopy(tip);
    if (t.length > 20 && n.includes(t.slice(0, 40))) return null;
  }
  return hint.trim();
}
