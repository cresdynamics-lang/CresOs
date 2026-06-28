export type EmailStatus =
  | "pending_draft"
  | "awaiting_approval"
  | "editing"
  | "approved"
  | "sent"
  | "failed"
  | "ignored";

export type SenderType = "external" | "internal";

export type ThreadSummary = {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  status: EmailStatus;
  senderType: SenderType;
  receivedAt: string;
  updatedAt: string;
  draftReply: string | null;
  waMessageSid: string | null;
};

export type ThreadDetail = ThreadSummary & {
  body: string;
  revisionNotes: string | null;
  messageId: string;
};

export type EmailStats = {
  total: number;
  pending: number;
  editing: number;
  drafting: number;
  sent: number;
  failed: number;
  ignored: number;
};

export type EmailTemplate = {
  key: string;
  name: string;
  category: "reply" | "compose" | "transactional";
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  design?: import("../../lib/email-template-design").EmailTemplateDesign;
  useCustomHtml?: boolean;
};

export const STATUS_LABELS: Record<EmailStatus, string> = {
  pending_draft: "Drafting",
  awaiting_approval: "Awaiting Review",
  editing: "Editing",
  approved: "Approved",
  sent: "Sent",
  failed: "Failed",
  ignored: "Ignored"
};

export const STATUS_FILTERS = [
  { key: "", label: "All", statKey: "total" as const },
  { key: "awaiting_approval", label: "Awaiting Review", statKey: "pending" as const },
  { key: "editing", label: "Editing", statKey: "editing" as const },
  { key: "pending_draft", label: "Drafting", statKey: "drafting" as const },
  { key: "sent", label: "Sent", statKey: "sent" as const },
  { key: "failed", label: "Failed", statKey: "failed" as const },
  { key: "ignored", label: "Ignored", statKey: "ignored" as const }
];

export const STATUS_TONE: Record<EmailStatus, string> = {
  pending_draft: "bg-slate-500/15 text-slate-300 ring-slate-500/20",
  awaiting_approval: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  editing: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  approved: "bg-teal-500/15 text-teal-300 ring-teal-500/25",
  sent: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  failed: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
  ignored: "bg-slate-600/10 text-slate-500 ring-slate-600/20"
};

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return `${Math.max(1, Math.round(diffMs / 60000))}m`;
  if (diffH < 24) return `${Math.round(diffH)}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function initials(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
