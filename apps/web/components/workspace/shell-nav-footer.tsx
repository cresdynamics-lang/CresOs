"use client";

type ShellNavFooterProps = {
  onOpenSettings: () => void;
  onLogout: () => void;
  roleKeys?: string[];
};

function roleLabel(key: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    director_admin: "Director",
    finance: "Finance",
    developer: "Developer",
    sales: "Sales",
    analyst: "Analyst",
    client: "Client"
  };
  return labels[key] ?? key;
}

export function ShellNavFooter({ onOpenSettings, onLogout, roleKeys = [] }: ShellNavFooterProps) {
  return (
    <div className="flex flex-col gap-1 px-1">
      {roleKeys.length > 0 ? (
        <div className="mb-1 flex flex-wrap gap-1 px-2">
          {roleKeys.map((r) => (
            <span key={r} className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              {roleLabel(r)}
            </span>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      >
        Settings
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      >
        Sign out
      </button>
    </div>
  );
}
