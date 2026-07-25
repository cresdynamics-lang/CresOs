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
    border: "border-emerald-200",
    bg: "from-emerald-50 via-white to-amber-50",
    glow: "shadow-sm",
    nameGradient: "from-emerald-700 via-teal-700 to-amber-700",
    roleText: "text-emerald-700",
    rolePill: "border-emerald-200 bg-emerald-50 text-emerald-800",
    sectionLabel: "text-amber-700",
    dot: "text-emerald-600"
  },
  admin: {
    border: "border-brand/30",
    bg: "from-brand-light via-white to-sky-50",
    glow: "shadow-sm",
    nameGradient: "from-brand via-sky-600 to-indigo-600",
    roleText: "text-brand",
    rolePill: "border-brand/30 bg-brand/10 text-brand",
    sectionLabel: "text-sky-700",
    dot: "text-brand"
  },
  director_admin: {
    border: "border-sky-200",
    bg: "from-sky-50 via-white to-brand-light/40",
    glow: "shadow-sm",
    nameGradient: "from-sky-700 via-cyan-700 to-brand",
    roleText: "text-sky-700",
    rolePill: "border-sky-200 bg-sky-50 text-sky-800",
    sectionLabel: "text-cyan-700",
    dot: "text-sky-600"
  },
  developer: {
    border: "border-violet-200",
    bg: "from-violet-50 via-white to-sky-50",
    glow: "shadow-sm",
    nameGradient: "from-violet-700 via-fuchsia-700 to-sky-700",
    roleText: "text-violet-700",
    rolePill: "border-violet-200 bg-violet-50 text-violet-800",
    sectionLabel: "text-violet-700",
    dot: "text-violet-600"
  },
  sales: {
    border: "border-amber-200",
    bg: "from-amber-50 via-white to-rose-50",
    glow: "shadow-sm",
    nameGradient: "from-amber-700 via-orange-700 to-rose-700",
    roleText: "text-amber-800",
    rolePill: "border-amber-200 bg-amber-50 text-amber-900",
    sectionLabel: "text-rose-700",
    dot: "text-amber-600"
  },
  analyst: {
    border: "border-cyan-200",
    bg: "from-cyan-50 via-white to-slate-50",
    glow: "shadow-sm",
    nameGradient: "from-cyan-700 to-slate-700",
    roleText: "text-cyan-700",
    rolePill: "border-cyan-200 bg-cyan-50 text-cyan-800",
    sectionLabel: "text-cyan-700",
    dot: "text-cyan-600"
  },
  hr: {
    border: "border-rose-200",
    bg: "from-rose-50 via-white to-pink-50",
    glow: "shadow-sm",
    nameGradient: "from-rose-700 via-pink-700 to-fuchsia-700",
    roleText: "text-rose-700",
    rolePill: "border-rose-200 bg-rose-50 text-rose-800",
    sectionLabel: "text-pink-700",
    dot: "text-rose-600"
  },
  project_manager: {
    border: "border-teal-200",
    bg: "from-teal-50 via-white to-cyan-50",
    glow: "shadow-sm",
    nameGradient: "from-teal-700 via-cyan-700 to-emerald-700",
    roleText: "text-teal-700",
    rolePill: "border-teal-200 bg-teal-50 text-teal-800",
    sectionLabel: "text-cyan-700",
    dot: "text-teal-600"
  },
  client: {
    border: "border-slate-200",
    bg: "from-slate-50 to-white",
    glow: "",
    nameGradient: "from-slate-800 to-slate-600",
    roleText: "text-slate-700",
    rolePill: "border-slate-200 bg-slate-50 text-slate-700",
    sectionLabel: "text-slate-500",
    dot: "text-slate-500"
  },
  default: {
    border: "border-brand/25",
    bg: "from-white via-[#eef4fb] to-brand-light/40",
    glow: "",
    nameGradient: "from-slate-900 to-brand",
    roleText: "text-slate-600",
    rolePill: "border-sky-200 bg-[#f5f9fc] text-slate-700",
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
