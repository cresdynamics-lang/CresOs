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
  danger: "font-display text-[1.125rem] font-bold leading-snug tracking-tight text-[#C50F1F] sm:text-[1.35rem]",
  warning: "font-display text-[1.125rem] font-bold leading-snug tracking-tight text-[#8A7000] sm:text-[1.35rem]",
  info: "font-display text-[1.125rem] font-bold leading-snug tracking-tight text-[#005CAB] sm:text-[1.35rem]"
};

const URGENCY_ACTION: Record<WorkspaceUrgencyTone, string> = {
  danger: "bg-[#C50F1F] text-white hover:bg-[#A50D19]",
  warning: "bg-[#C19C00] text-white hover:bg-[#A68500]",
  info: "bg-[#005CAB] text-white hover:bg-[#004A8C]"
};

type WorkspacePriorityGridProps = {
  items: WorkspacePriorityItem[];
  panelClass: (tone: WorkspaceUrgencyTone) => string;
  dismissible?: (id: string) => ReactNode;
};

export function WorkspacePriorityGrid({ items, panelClass, dismissible }: WorkspacePriorityGridProps) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 grid w-full gap-2 lg:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className={`${panelClass(item.tone)} bg-white`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3.5 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className={URGENCY_TITLE[item.tone]}>{item.title}</p>
              <p className="mt-1.5 font-body text-[13px] font-medium leading-relaxed text-[#605E5C]">{item.detail}</p>
              {dismissible?.(item.id)}
            </div>
            <Link
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${URGENCY_ACTION[item.tone]}`}
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
      <div className={`mt-0 bg-white ${panelClass}`}>
        {tips.length > 0 ? (
          <ul className="space-y-3">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#005CAB]"
                  aria-hidden
                />
                <span className="font-body text-[14px] font-medium leading-relaxed tracking-[-0.01em] text-[#3B3A39]">
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {aiHint ? (
          <p
            className={`font-display text-[15px] font-semibold leading-snug tracking-tight text-[#005CAB] ${
              tips.length > 0 ? "mt-4 border-t border-[#E1DFDD] pt-4" : ""
            }`}
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
