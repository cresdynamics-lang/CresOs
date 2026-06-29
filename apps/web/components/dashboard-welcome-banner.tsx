import type { ReactNode } from "react";
import { buildWelcomeHeadlineForName, buildWelcomeSupportLine } from "../lib/personalized-greeting";

export type RoleThemeKey =
  | "admin"
  | "director_admin"
  | "finance"
  | "developer"
  | "sales"
  | "analyst"
  | "hr"
  | "project_manager"
  | "client"
  | "default";

type RoleTheme = {
  border: string;
  bg: string;
  glow: string;
  nameGradient: string;
  roleText: string;
  rolePill: string;
  sectionLabel: string;
  dot: string;
};

const ROLE_THEMES: Record<RoleThemeKey, RoleTheme> = {
  finance: {
    border: "border-emerald-500/40",
    bg: "from-emerald-950/50 via-slate-900/80 to-amber-950/30",
    glow: "shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]",
    nameGradient: "from-emerald-200 via-teal-100 to-amber-200",
    roleText: "text-emerald-300",
    rolePill: "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
    sectionLabel: "text-amber-400",
    dot: "text-emerald-500"
  },
  admin: {
    border: "border-brand/45",
    bg: "from-brand/15 via-slate-900/80 to-violet-950/25",
    glow: "shadow-[0_0_40px_-12px_rgba(31,111,235,0.35)]",
    nameGradient: "from-sky-200 via-brand-200 to-violet-200",
    roleText: "text-brand",
    rolePill: "border-brand/50 bg-brand/15 text-sky-200",
    sectionLabel: "text-sky-400",
    dot: "text-brand"
  },
  director_admin: {
    border: "border-sky-500/40",
    bg: "from-sky-950/45 via-slate-900/80 to-brand/10",
    glow: "shadow-[0_0_40px_-12px_rgba(56,189,248,0.3)]",
    nameGradient: "from-sky-200 via-cyan-100 to-brand-200",
    roleText: "text-sky-300",
    rolePill: "border-sky-500/50 bg-sky-500/15 text-sky-100",
    sectionLabel: "text-cyan-400",
    dot: "text-sky-400"
  },
  developer: {
    border: "border-violet-500/40",
    bg: "from-violet-950/45 via-slate-900/80 to-sky-950/20",
    glow: "shadow-[0_0_40px_-12px_rgba(139,92,246,0.3)]",
    nameGradient: "from-violet-200 via-fuchsia-100 to-sky-200",
    roleText: "text-violet-300",
    rolePill: "border-violet-500/50 bg-violet-500/15 text-violet-100",
    sectionLabel: "text-violet-400",
    dot: "text-violet-400"
  },
  sales: {
    border: "border-amber-500/40",
    bg: "from-amber-950/40 via-slate-900/80 to-rose-950/20",
    glow: "shadow-[0_0_40px_-12px_rgba(245,158,11,0.28)]",
    nameGradient: "from-amber-200 via-orange-100 to-rose-200",
    roleText: "text-amber-300",
    rolePill: "border-amber-500/50 bg-amber-500/15 text-amber-100",
    sectionLabel: "text-rose-400",
    dot: "text-amber-400"
  },
  analyst: {
    border: "border-cyan-500/35",
    bg: "from-cyan-950/35 via-slate-900/80 to-slate-900/90",
    glow: "shadow-[0_0_32px_-12px_rgba(34,211,238,0.25)]",
    nameGradient: "from-cyan-200 to-slate-100",
    roleText: "text-cyan-300",
    rolePill: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100",
    sectionLabel: "text-cyan-400",
    dot: "text-cyan-400"
  },
  hr: {
    border: "border-rose-500/40",
    bg: "from-rose-950/45 via-slate-900/80 to-pink-950/25",
    glow: "shadow-[0_0_40px_-12px_rgba(244,63,94,0.32)]",
    nameGradient: "from-rose-200 via-pink-100 to-fuchsia-200",
    roleText: "text-rose-300",
    rolePill: "border-rose-500/50 bg-rose-500/15 text-rose-100",
    sectionLabel: "text-pink-400",
    dot: "text-rose-400"
  },
  project_manager: {
    border: "border-teal-500/40",
    bg: "from-teal-950/45 via-slate-900/80 to-cyan-950/20",
    glow: "shadow-[0_0_40px_-12px_rgba(20,184,166,0.32)]",
    nameGradient: "from-teal-200 via-cyan-100 to-emerald-200",
    roleText: "text-teal-300",
    rolePill: "border-teal-500/50 bg-teal-500/15 text-teal-100",
    sectionLabel: "text-cyan-400",
    dot: "text-teal-400"
  },
  client: {
    border: "border-slate-500/40",
    bg: "from-slate-900/90 to-slate-950/90",
    glow: "",
    nameGradient: "from-slate-100 to-slate-300",
    roleText: "text-slate-300",
    rolePill: "border-slate-600 bg-slate-800/80 text-slate-200",
    sectionLabel: "text-slate-400",
    dot: "text-slate-500"
  },
  default: {
    border: "border-brand/25",
    bg: "from-slate-900/90 via-slate-900/70 to-brand/5",
    glow: "",
    nameGradient: "from-slate-50 to-slate-300",
    roleText: "text-slate-400",
    rolePill: "border-slate-600 bg-slate-800/60 text-slate-300",
    sectionLabel: "text-slate-500",
    dot: "text-brand"
  }
};

export function resolveRoleTheme(roleKeys: string[]): RoleTheme {
  const order: RoleThemeKey[] = [
    "admin",
    "director_admin",
    "finance",
    "hr",
    "project_manager",
    "sales",
    "developer",
    "analyst",
    "client"
  ];
  for (const key of order) {
    if (roleKeys.includes(key)) return ROLE_THEMES[key];
  }
  return ROLE_THEMES.default;
}

type Props = {
  firstName: string;
  roleLabel: string;
  roleKeys?: string[];
  /** When false, hides the uppercase role pill (e.g. DEVELOPER) under the welcome name. */
  showRoleLabel?: boolean;
  /** Override headline; default is time-based greeting + first name from auth. */
  headline?: string;
  /** Override support line under headline. */
  supportLine?: string;
  children?: ReactNode;
  /** Optional wrapper classes (e.g. embed inside a neu hero without double borders). */
  className?: string;
};

export function DashboardWelcomeBanner({
  firstName,
  roleLabel,
  roleKeys = [],
  showRoleLabel = true,
  headline,
  supportLine,
  children,
  className = ""
}: Props) {
  const greeting = headline?.trim() || buildWelcomeHeadlineForName(firstName);
  const subline = supportLine?.trim() || buildWelcomeSupportLine();
  const theme = resolveRoleTheme(roleKeys);

  return (
    <div
      className={`shell min-w-0 border-l-4 bg-gradient-to-br ${theme.border} ${theme.bg} ${theme.glow} ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            className={`font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl bg-gradient-to-r ${theme.nameGradient} bg-clip-text text-transparent`}
          >
            {greeting}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-body text-sm">
            {showRoleLabel ? (
              <span
                className={`inline-flex rounded-full border px-3 py-0.5 font-label text-xs font-semibold uppercase tracking-widest ${theme.rolePill}`}
              >
                {roleLabel}
              </span>
            ) : null}
            <span className={`${theme.roleText} font-medium`}>{subline}</span>
          </p>
        </div>
      </div>
      {children ? (
        <div className="mt-5 border-t border-slate-700/50 pt-5">{children}</div>
      ) : null}
    </div>
  );
}

export function DashboardSectionLabel({
  children,
  roleKeys = [],
  tone = "priorities"
}: {
  children: ReactNode;
  roleKeys?: string[];
  tone?: "priorities" | "focus" | "dashboard";
}) {
  const theme = resolveRoleTheme(roleKeys);
  const color =
    tone === "focus"
      ? "text-violet-400"
      : tone === "dashboard"
        ? "text-brand"
        : theme.sectionLabel;

  return (
    <p
      className={`mb-3 font-label text-[11px] font-semibold uppercase tracking-[0.22em] ${color}`}
    >
      {children}
    </p>
  );
}

const BULLET_MARKER: Record<RoleThemeKey, string> = {
  finance: "marker:text-emerald-500",
  admin: "marker:text-brand",
  director_admin: "marker:text-sky-500",
  developer: "marker:text-violet-500",
  sales: "marker:text-amber-500",
  analyst: "marker:text-cyan-500",
  hr: "marker:text-rose-500",
  project_manager: "marker:text-teal-500",
  client: "marker:text-slate-500",
  default: "marker:text-brand"
};

export function WelcomeBullet({ children, roleKeys = [] }: { children: ReactNode; roleKeys?: string[] }) {
  const key = roleKeys.find((k) => k in ROLE_THEMES) as RoleThemeKey | undefined;
  const marker = BULLET_MARKER[key ?? "default"];
  return (
    <li
      className={`font-body text-sm leading-relaxed text-slate-200 ${marker} [&_a]:font-semibold [&_a]:text-sky-400 [&_a]:underline-offset-2 [&_a]:hover:text-sky-300 [&_a]:hover:underline`}
    >
      {children}
    </li>
  );
}

type DashboardIntroHeaderProps = {
  title: string;
  description: string;
  roleKeys?: string[];
};

export function DashboardIntroHeader({ title, description, roleKeys = [] }: DashboardIntroHeaderProps) {
  const theme = resolveRoleTheme(roleKeys);

  return (
    <div className="mb-4 min-w-0 border-b border-slate-800/80 pb-5 sm:mb-6">
      <p className="font-label text-[10px] font-medium uppercase tracking-[0.3em] text-slate-500">
        Workspace
      </p>
      <h1
        className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r ${theme.nameGradient} bg-clip-text text-transparent`}
      >
        {title}
      </h1>
      <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-slate-400 sm:text-[15px]">
        <span className={`font-semibold ${theme.roleText}`}>Operating System for Growth</span>
        <span className="text-slate-500"> — </span>
        {description.replace(/^Operating System for Growth\s*[—–-]\s*/i, "")}
      </p>
    </div>
  );
}
