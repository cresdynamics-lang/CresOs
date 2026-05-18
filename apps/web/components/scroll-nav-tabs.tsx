"use client";

export type ScrollNavTab = {
  key: string;
  label: string;
  /** Shorter label on narrow screens (defaults to `label`). */
  shortLabel?: string;
};

type ScrollNavTabsProps = {
  tabs: readonly ScrollNavTab[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  className?: string;
};

/**
 * Section switcher: horizontal scroll + snap on phones, wraps on larger screens.
 */
export function ScrollNavTabs({
  tabs,
  activeKey,
  onChange,
  ariaLabel = "Sections",
  className = ""
}: ScrollNavTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={[
        "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1",
        "[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tabs.map((tab) => {
        const active = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={active ? "page" : undefined}
            className={[
              "min-h-[44px] shrink-0 snap-start touch-manipulation rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "sm:min-h-0 sm:py-2",
              active
                ? "bg-slate-600 text-white shadow-sm"
                : "border border-slate-600 text-slate-300 hover:bg-slate-800 active:bg-slate-700"
            ].join(" ")}
          >
            <span className="whitespace-nowrap sm:hidden">{tab.shortLabel ?? tab.label}</span>
            <span className="hidden whitespace-nowrap sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
