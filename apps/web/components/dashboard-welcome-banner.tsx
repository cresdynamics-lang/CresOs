import type { ReactNode } from "react";

type Props = {
  firstName: string;
  roleLabel: string;
  children?: ReactNode;
};

/**
 * Personalized greeting + actionable bullets (counts/links supplied by parent).
 */
export function DashboardWelcomeBanner({ firstName, roleLabel, children }: Props) {
  const safe = firstName.trim() || "there";
  return (
    <div className="shell min-w-0 border-brand/25 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-brand/5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-50">
            Welcome, {safe}
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {roleLabel} · Here&apos;s what matters for you right now.
          </p>
        </div>
      </div>
      {children ? (
        <div className="mt-4 border-t border-slate-700/60 pt-4">{children}</div>
      ) : null}
    </div>
  );
}

export function WelcomeBullet({ children }: { children: ReactNode }) {
  return (
    <li className="text-sm leading-relaxed text-slate-200 marker:text-slate-500 [&_a]:font-medium [&_a]:text-sky-400 [&_a]:underline-offset-2 [&_a]:hover:underline">
      {children}
    </li>
  );
}
