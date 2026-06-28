"use client";

const RISK_STYLES = {
  healthy: { ring: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/25", label: "Healthy" },
  watch: { ring: "text-sky-400", bg: "bg-sky-500/15", border: "border-sky-500/25", label: "Watch" },
  at_risk: { ring: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25", label: "At risk" },
  critical: { ring: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/25", label: "Critical" }
} as const;

export type PmRiskLevel = keyof typeof RISK_STYLES;

export function PmHealthBadge({
  score,
  riskLevel,
  size = "md"
}: {
  score: number;
  riskLevel: PmRiskLevel;
  size?: "sm" | "md";
}) {
  const s = RISK_STYLES[riskLevel] ?? RISK_STYLES.watch;
  const dim = size === "sm" ? "h-10 w-10 text-xs" : "h-14 w-14 text-sm";
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center rounded-full border ${s.border} ${s.bg} ${dim} font-bold tabular-nums ${s.ring}`}
      title={`${s.label} · ${score}/100`}
    >
      {score}
    </div>
  );
}

export function PmRiskPill({ riskLevel }: { riskLevel: PmRiskLevel }) {
  const s = RISK_STYLES[riskLevel] ?? RISK_STYLES.watch;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.border} ${s.bg} ${s.ring}`}>
      {s.label}
    </span>
  );
}
