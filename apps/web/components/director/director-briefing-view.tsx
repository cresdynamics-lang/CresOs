"use client";

import { useMemo, useState } from "react";
import { directorNeu } from "./director-theme";

export type BriefingItem = {
  raw: string;
  time?: string;
  source?: string;
  type?: string;
  label?: string;
  detail?: string;
  summary: string;
  warning?: boolean;
  noReport?: boolean;
};

export type BriefingSection = {
  id: string;
  title: string;
  content: string;
  items: BriefingItem[];
  subsections?: { label: string; items: BriefingItem[] }[];
};

export type ParsedBriefing = {
  title: string;
  subtitle: string;
  sections: BriefingSection[];
};

const SECTION_META: Record<
  string,
  { accent: string; border: string; bg: string; icon: string }
> = {
  glance: {
    accent: "text-sky-300",
    border: "border-sky-500/25",
    bg: "bg-sky-950/20",
    icon: "◎"
  },
  platform: {
    accent: "text-slate-300",
    border: "border-white/10",
    bg: "bg-[#0e1319]",
    icon: "⚡"
  },
  shipped: {
    accent: "text-emerald-300",
    border: "border-emerald-500/25",
    bg: "bg-emerald-950/15",
    icon: "✓"
  },
  progress: {
    accent: "text-cyan-300",
    border: "border-cyan-500/20",
    bg: "bg-cyan-950/10",
    icon: "↻"
  },
  blocked: {
    accent: "text-amber-300",
    border: "border-amber-500/25",
    bg: "bg-amber-950/15",
    icon: "⏸"
  },
  sales: {
    accent: "text-violet-300",
    border: "border-violet-500/25",
    bg: "bg-violet-950/15",
    icon: "◈"
  },
  team: {
    accent: "text-indigo-300",
    border: "border-indigo-500/20",
    bg: "bg-indigo-950/10",
    icon: "◉"
  },
  attention: {
    accent: "text-rose-300",
    border: "border-rose-500/30",
    bg: "bg-rose-950/20",
    icon: "!"
  },
  tomorrow: {
    accent: "text-teal-300",
    border: "border-teal-500/20",
    bg: "bg-teal-950/10",
    icon: "→"
  },
  end: {
    accent: "text-slate-500",
    border: "border-white/5",
    bg: "bg-transparent",
    icon: "—"
  },
  default: {
    accent: "text-slate-300",
    border: "border-white/8",
    bg: "bg-[#10161e]",
    icon: "•"
  }
};

function sectionKey(title: string): keyof typeof SECTION_META {
  const t = title.toUpperCase();
  if (t.includes("AT A GLANCE")) return "glance";
  if (t.includes("PLATFORM ACTIONS")) return "platform";
  if (t.includes("SHIPPED")) return "shipped";
  if (t.includes("IN PROGRESS")) return "progress";
  if (t.includes("PENDING") || t.includes("BLOCKED")) return "blocked";
  if (t.includes("SALES PIPELINE")) return "sales";
  if (t.includes("ACCOUNTABILITY")) return "team";
  if (t.includes("ATTENTION")) return "attention";
  if (t.includes("TOMORROW")) return "tomorrow";
  if (t.includes("END OF BRIEFING")) return "end";
  return "default";
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePlatformAction(line: string): BriefingItem {
  const stripped = line.replace(/^[*•⚠]\s*/, "").trim();
  const parts = stripped.split(" - ").map((p) => p.trim());
  if (parts.length >= 4 && /^\d{4}-\d{2}-\d{2}T/.test(parts[0])) {
    const [iso, source, type, ...rest] = parts;
    let timeLabel = iso;
    try {
      timeLabel = new Date(iso).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      // keep iso
    }
    return {
      raw: line,
      time: timeLabel,
      source,
      type,
      summary: rest.join(" - ")
    };
  }
  return { raw: line, summary: stripped };
}

function parseBullet(line: string): BriefingItem {
  const warning = /^⚠/.test(line.trim());
  const noReport = /NO REPORT SUBMITTED/i.test(line);
  const stripped = line.replace(/^[*•⚠]\s*/, "").trim();
  const segments = stripped.split(/\s+—\s+|\s+-\s+/).map((s) => s.trim());
  return {
    raw: line,
    label: segments[0] || undefined,
    detail: segments.length > 1 ? segments.slice(1).join(" — ") : undefined,
    summary: stripped,
    warning,
    noReport
  };
}

function parseSectionItems(title: string, content: string): BriefingItem[] {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const isPlatform = title.toUpperCase().includes("PLATFORM ACTIONS");
  return lines
    .filter((l) => !/^(DEVELOPERS|SALES):$/i.test(l))
    .map((l) => (isPlatform || /^\d{4}-\d{2}-\d{2}T/.test(l.replace(/^[*•]\s*/, "")) ? parsePlatformAction(l) : parseBullet(l)));
}

function parseTeamSubsections(content: string): { label: string; items: BriefingItem[] }[] {
  const lines = content.split("\n").map((l) => l.trim());
  const subs: { label: string; items: BriefingItem[] }[] = [];
  let current: { label: string; items: BriefingItem[] } | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (/^DEVELOPERS:$/i.test(line)) {
      current = { label: "Developers", items: [] };
      subs.push(current);
      continue;
    }
    if (/^SALES:$/i.test(line)) {
      current = { label: "Sales", items: [] };
      subs.push(current);
      continue;
    }
    if (/^\(Any role member/i.test(line)) {
      current = { label: "Missing reports", items: [] };
      subs.push(current);
      continue;
    }
    const item = parseBullet(line);
    if (current) current.items.push(item);
    else {
      if (!subs.find((s) => s.label === "General")) {
        subs.push({ label: "General", items: [] });
      }
      subs[subs.length - 1].items.push(item);
    }
  }
  return subs.filter((s) => s.items.length > 0);
}

export function parseDirectorBriefing(body: string): ParsedBriefing {
  const raw = body.trim();
  const chunks = raw
    .split(/\n[━─]{8,}\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  let title = "Director Briefing";
  let subtitle = "";
  const sections: BriefingSection[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim());
    const nonEmpty = lines.filter(Boolean);
    if (nonEmpty.length === 0) continue;

    const firstLine = nonEmpty[0];
    if (firstLine.toUpperCase().includes("DIRECTOR BRIEFING") && nonEmpty.length <= 3) {
      title = firstLine.replace(/^CRES DYNAMICS\s*[—-]\s*/i, "").trim() || firstLine;
      subtitle = nonEmpty[1] ?? "";
      continue;
    }

    const sectionTitle = firstLine;
    const content = nonEmpty.slice(1).join("\n");
    const isTeam = sectionTitle.toUpperCase().includes("ACCOUNTABILITY");

    sections.push({
      id: slugify(sectionTitle),
      title: sectionTitle,
      content,
      items: isTeam ? [] : parseSectionItems(sectionTitle, content),
      subsections: isTeam ? parseTeamSubsections(content) : undefined
    });
  }

  if (sections.length === 0 && raw) {
    sections.push({
      id: "content",
      title: "Briefing",
      content: raw,
      items: parseSectionItems("Briefing", raw)
    });
  }

  return { title, subtitle, sections };
}

export function briefingAtAGlance(body: string, maxLen = 220): string {
  const parsed = parseDirectorBriefing(body);
  const glance = parsed.sections.find((s) => s.title.toUpperCase().includes("AT A GLANCE"));
  const text = glance?.content.trim() || parsed.sections[0]?.content.trim() || body.replace(/\n[━─]{8,}\n/g, "\n").trim();
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxLen ? `${flat.slice(0, maxLen)}…` : flat;
}

function PlatformActionRow({ item }: { item: BriefingItem }) {
  return (
    <li className="flex gap-3 rounded-lg border border-white/[0.04] bg-[#0b1016] px-3 py-2.5">
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-sky-400/90">{item.time ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.source && (
            <span className="rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {item.source}
            </span>
          )}
          {item.type && (
            <span className="rounded-md bg-sky-950/60 px-1.5 py-0.5 font-mono text-[10px] text-sky-300/90">
              {item.type}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.summary}</p>
      </div>
    </li>
  );
}

function BulletRow({ item, accent }: { item: BriefingItem; accent: string }) {
  if (item.noReport) {
    return (
      <li className={`rounded-lg border border-rose-500/30 bg-rose-950/25 px-3 py-2.5 ${directorNeu.alertDanger}`}>
        <p className="text-sm font-medium text-rose-200">{item.label ?? item.summary}</p>
        {item.detail && <p className="mt-0.5 text-xs text-rose-300/80">{item.detail}</p>}
      </li>
    );
  }
  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        item.warning ? directorNeu.alertWarning : "border-white/[0.04] bg-[#0b1016]"
      }`}
    >
      <div className="flex gap-2">
        <span className={`shrink-0 text-xs ${accent}`}>{item.warning ? "⚠" : "•"}</span>
        <div className="min-w-0">
          {item.label && item.detail ? (
            <>
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{item.detail}</p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">{item.summary}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function BriefingSectionCard({
  section,
  defaultOpen
}: {
  section: BriefingSection;
  defaultOpen?: boolean;
}) {
  const key = sectionKey(section.title);
  const meta = SECTION_META[key];
  const [open, setOpen] = useState(defaultOpen ?? key !== "end");
  const isGlance = key === "glance";
  const isPlatform = key === "platform";
  const isEnd = key === "end";

  if (isEnd) {
    return (
      <p className="pt-2 text-center text-[11px] uppercase tracking-[0.2em] text-slate-600">{section.content || section.title}</p>
    );
  }

  return (
    <article className={`overflow-hidden rounded-2xl border ${meta.border} ${meta.bg}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-[#121820] text-sm ${meta.accent}`}
            aria-hidden
          >
            {meta.icon}
          </span>
          <h3 className={`text-xs font-semibold uppercase tracking-[0.14em] sm:text-sm ${meta.accent}`}>
            {section.title}
          </h3>
        </div>
        <span className="shrink-0 text-xs text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="border-t border-white/[0.04] px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          {isGlance && section.content && !section.items.length ? (
            <p className="text-base leading-relaxed text-slate-200 sm:text-[1.05rem]">{section.content}</p>
          ) : isGlance && section.items.length > 0 ? (
            <p className="text-base leading-relaxed text-slate-200 sm:text-[1.05rem]">
              {section.items.map((i) => i.summary).join(" ")}
            </p>
          ) : isPlatform && section.items.length > 0 ? (
            <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto pr-1">
              {section.items.map((item, i) => (
                <PlatformActionRow key={`${item.raw}-${i}`} item={item} />
              ))}
            </ul>
          ) : section.subsections && section.subsections.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {section.subsections.map((sub) => (
                <div key={sub.label}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{sub.label}</p>
                  <ul className="space-y-2">
                    {sub.items.map((item, i) => (
                      <BulletRow key={`${sub.label}-${i}`} item={item} accent={meta.accent} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : section.items.length > 0 ? (
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <BulletRow key={`${item.raw}-${i}`} item={item} accent={meta.accent} />
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-slate-400">{section.content || "No entries for this section."}</p>
          )}
        </div>
      )}
    </article>
  );
}

export function DirectorBriefingDocument({
  body,
  generatedAt,
  dateKey,
  subject,
  className = ""
}: {
  body: string;
  generatedAt?: string;
  dateKey?: string;
  subject?: string;
  className?: string;
}) {
  const parsed = useMemo(() => parseDirectorBriefing(body), [body]);
  const dateLabel = useMemo(() => {
    if (dateKey) {
      const d = new Date(`${dateKey}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      }
    }
    return dateKey ?? "";
  }, [dateKey]);

  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : null;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <header className={`${directorNeu.panel} border-sky-500/15`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400/80">Cres Dynamics</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
              {parsed.title}
            </h2>
            {subject && <p className="mt-1 text-sm text-slate-400">{subject}</p>}
            <p className="mt-2 text-sm text-slate-500">{parsed.subtitle || dateLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dateLabel && (
              <span className="rounded-full border border-sky-500/25 bg-sky-950/40 px-3 py-1 text-xs font-medium text-sky-200">
                {dateLabel}
              </span>
            )}
            {generatedLabel && (
              <span className="rounded-full border border-white/10 bg-[#0e1319] px-3 py-1 text-xs text-slate-400">
                Generated {generatedLabel}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {parsed.sections.map((section, idx) => (
          <BriefingSectionCard key={section.id} section={section} defaultOpen={idx < 4 || sectionKey(section.title) === "attention"} />
        ))}
      </div>
    </div>
  );
}

export function DirectorBriefingPreview({ body, className = "" }: { body: string; className?: string }) {
  const text = useMemo(() => briefingAtAGlance(body), [body]);
  const parsed = useMemo(() => parseDirectorBriefing(body), [body]);
  const attention = parsed.sections.find((s) => s.title.toUpperCase().includes("ATTENTION"));
  const attentionCount =
    attention?.items.filter((i) => i.warning || !/no escalations/i.test(i.summary)).length ?? 0;

  return (
    <div className={className}>
      <p className="text-sm leading-relaxed text-slate-400">{text}</p>
      {attentionCount > 0 && (
        <p className="mt-2 text-xs font-medium text-amber-300/90">
          {attentionCount} item{attentionCount === 1 ? "" : "s"} need attention
        </p>
      )}
    </div>
  );
}
