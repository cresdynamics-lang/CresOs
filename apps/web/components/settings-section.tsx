import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Flat full-width settings block (no card shell). */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="border-b border-slate-800/70 pb-10 last:border-b-0 last:pb-0">
      <h2 className="font-display text-base font-semibold text-slate-100">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
