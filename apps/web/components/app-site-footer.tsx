import Link from "next/link";

export function AppSiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`shrink-0 border-t border-slate-800/90 bg-slate-950/95 px-3 py-3 sm:px-6 ${className}`.trim()}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center text-[11px] text-slate-500 sm:flex-row sm:text-left">
        <p>
          <span className="text-slate-400">CresOS</span>
          <span className="mx-1.5 text-slate-600">·</span>
          Operating system for growth
        </p>
        <p>
          Built by{" "}
          <a
            href="https://cresdynamics.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400/90 underline-offset-2 hover:text-sky-300 hover:underline"
          >
            Cres Dynamics
          </a>
        </p>
      </div>
    </footer>
  );
}
