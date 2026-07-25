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
    accent: "text-[#2563EB]",
    border: "border-sky-500/25",
    bg: "bg-[#F0F6FC]",
    icon: "◎"
  },
  platform: {
    accent: "text-[#5B6472]",
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    icon: "⚡"
  },
  shipped: {
    accent: "text-[#1B6B3A]",
    border: "border-emerald-500/25",
    bg: "bg-[#F2F9EF]",
    icon: "✓"
  },
  progress: {
    accent: "text-[#0E7490]",
    border: "border-cyan-500/20",
    bg: "bg-[#ECFAFB]",
    icon: "↻"
  },
  blocked: {
    accent: "text-[#B45309]",
    border: "border-amber-500/25",
    bg: "bg-[#FFF6E5]",
    icon: "⏸"
  },
  sales: {
    accent: "text-[#6D28D9]",
    border: "border-violet-500/25",
    bg: "bg-[#F9F0FB]",
    icon: "◈"
  },
  team: {
    accent: "text-[#4338CA]",
    border: "border-indigo-500/20",
    bg: "bg-[#EEF1FB]",
    icon: "◉"
  },
  attention: {
    accent: "text-[#C62828]",
    border: "border-rose-500/30",
    bg: "bg-[#FEF2F2]",
    icon: "!"
  },
  tomorrow: {
    accent: "text-[#2D5A5A]",
    border: "border-teal-500/20",
    bg: "bg-[#E8F0F0]",
    icon: "→"
  },
  end: {
    accent: "text-[#5B6472]",
    border: "border-[#E5E9EF]",
    bg: "bg-transparent",
    icon: "—"
  },
  default: {
    accent: "text-[#5B6472]",
    border: "border-[#E5E9EF]",
    bg: "bg-white",
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
    <li className="flex gap-3 rounded-lg border border-[#E5E9EF] bg-white px-3 py-2.5">
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#2563EB]/90">{item.time ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.source && (
            <span className="rounded-md bg-[#F4F7F9] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#5B6472]">
              {item.source}
            </span>
          )}
          {item.type && (
            <span className="rounded-md bg-[#F0F6FC] px-1.5 py-0.5 font-mono text-[10px] text-[#2563EB]/90">
              {item.type}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[#5B6472]">{item.summary}</p>
      </div>
    </li>
  );
}

function BulletRow({ item, accent }: { item: BriefingItem; accent: string }) {
  if (item.noReport) {
    return (
      <li className={`rounded-lg border border-rose-500/30 bg-[#FEF2F2] px-3 py-2.5 ${directorNeu.alertDanger}`}>
        <p className="text-sm font-medium text-[#C62828]">{item.label ?? item.summary}</p>
        {item.detail && <p className="mt-0.5 text-xs text-[#C62828]/80">{item.detail}</p>}
      </li>
    );
  }
  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        item.warning ? directorNeu.alertWarning : "border-[#E5E9EF] bg-white"
      }`}
    >
      <div className="flex gap-2">
        <span className={`shrink-0 text-xs ${accent}`}>{item.warning ? "⚠" : "•"}</span>
        <div className="min-w-0">
          {item.label && item.detail ? (
            <>
              <p className="text-sm font-medium text-[#1A1D26]">{item.label}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[#5B6472]">{item.detail}</p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-[#5B6472]">{item.summary}</p>
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
      <p className="pt-2 text-center text-[11px] uppercase tracking-[0.2em] text-[#5B6472]">{section.content || section.title}</p>
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
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#E5E9EF] bg-white text-sm ${meta.accent}`}
            aria-hidden
          >
            {meta.icon}
          </span>
          <h3 className={`text-xs font-semibold uppercase tracking-[0.14em] sm:text-sm ${meta.accent}`}>
            {section.title}
          </h3>
        </div>
        <span className="shrink-0 text-xs text-[#5B6472]">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="border-t border-[#E5E9EF] px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          {isGlance && section.content && !section.items.length ? (
            <p className="text-base leading-relaxed text-[#1A1D26] sm:text-[1.05rem]">{section.content}</p>
          ) : isGlance && section.items.length > 0 ? (
            <p className="text-base leading-relaxed text-[#1A1D26] sm:text-[1.05rem]">
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
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">{sub.label}</p>
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
            <p className="text-sm leading-relaxed text-[#5B6472]">{section.content || "No entries for this section."}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]/80">Cres Dynamics</p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
              {parsed.title}
            </h2>
            {subject && <p className="mt-1 text-sm text-[#5B6472]">{subject}</p>}
            <p className="mt-2 text-sm text-[#5B6472]">{parsed.subtitle || dateLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dateLabel && (
              <span className="rounded-full border border-sky-500/25 bg-[#F0F6FC] px-3 py-1 text-xs font-medium text-sky-200">
                {dateLabel}
              </span>
            )}
            {generatedLabel && (
              <span className="rounded-full border border-[#E5E9EF] bg-white px-3 py-1 text-xs text-[#5B6472]">
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
      <p className="text-sm leading-relaxed text-[#5B6472]">{text}</p>
      {attentionCount > 0 && (
        <p className="mt-2 text-xs font-medium text-[#B45309]/90">
          {attentionCount} item{attentionCount === 1 ? "" : "s"} need attention
        </p>
      )}
    </div>
  );
}
