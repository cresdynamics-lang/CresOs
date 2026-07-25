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
  nameColor: string;
  roleText: string;
  rolePill: string;
  sectionLabel: string;
  dot: string;
};

const ROLE_THEMES: Record<RoleThemeKey, RoleTheme> = {
  finance: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  admin: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  director_admin: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  developer: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  sales: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  analyst: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  hr: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  project_manager: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#2D5A5A]",
    rolePill: "border-[#E5E9EF] bg-[#E8F0F0] text-[#2D5A5A]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
  },
  client: {
    border: "border-[#E5E9EF]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#5B6472]",
    rolePill: "border-[#E5E9EF] bg-[#F4F7F9] text-[#5B6472]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#5B6472]"
  },
  default: {
    border: "border-[#2D5A5A]",
    bg: "bg-white",
    glow: "shadow-sm",
    nameColor: "text-[#1A1D26]",
    roleText: "text-[#5B6472]",
    rolePill: "border-[#E5E9EF] bg-[#F4F7F9] text-[#5B6472]",
    sectionLabel: "text-[#5B6472]",
    dot: "text-[#2D5A5A]"
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
      className={`shell min-w-0 border-l-4 ${theme.border} ${theme.bg} ${theme.glow} ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            className={`font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl ${theme.nameColor}`}
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
        <div className="mt-5 border-t border-[#E5E9EF] pt-5">{children}</div>
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
      ? "text-[#2D5A5A]"
      : tone === "dashboard"
        ? "text-[#2D5A5A]"
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
  finance: "marker:text-[#2D5A5A]",
  admin: "marker:text-[#2D5A5A]",
  director_admin: "marker:text-[#2D5A5A]",
  developer: "marker:text-[#2D5A5A]",
  sales: "marker:text-[#2D5A5A]",
  analyst: "marker:text-[#2D5A5A]",
  hr: "marker:text-[#2D5A5A]",
  project_manager: "marker:text-[#2D5A5A]",
  client: "marker:text-[#5B6472]",
  default: "marker:text-[#2D5A5A]"
};

export function WelcomeBullet({ children, roleKeys = [] }: { children: ReactNode; roleKeys?: string[] }) {
  const key = roleKeys.find((k) => k in ROLE_THEMES) as RoleThemeKey | undefined;
  const marker = BULLET_MARKER[key ?? "default"];
  return (
    <li
      className={`font-body text-sm leading-relaxed text-[#5B6472] ${marker} [&_a]:font-semibold [&_a]:text-[#2D5A5A] [&_a]:underline-offset-2 [&_a]:hover:underline`}
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
    <div className="mb-4 min-w-0 border-b border-[#E5E9EF] pb-5 sm:mb-6">
      <p className="font-label text-[10px] font-medium uppercase tracking-[0.3em] text-[#5B6472]">
        Workspace
      </p>
      <h1 className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl ${theme.nameColor}`}>
        {title}
      </h1>
      <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-[#5B6472] sm:text-[15px]">
        <span className={`font-semibold ${theme.roleText}`}>Operating System for Growth</span>
        <span className="text-[#5B6472]"> — </span>
        {description.replace(/^Operating System for Growth\s*[—–-]\s*/i, "")}
      </p>
    </div>
  );
}
