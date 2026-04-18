import type { ReactNode } from "react";

const LG_COLS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6"
};

type DashboardCardRowProps = {
  children: ReactNode;
  /** When `layout` is `responsive`, grid column count from `lg` breakpoint up. */
  lgCols?: 2 | 3 | 4 | 5 | 6;
  /** `responsive` = horizontal row + snap on small screens, grid from `lg`. `scroll` = always one scrollable row. */
  layout?: "responsive" | "scroll";
  className?: string;
};

/**
 * KPI / quick-link cards: one horizontal row on phones (scroll + snap), optional grid on large screens.
 */
export function DashboardCardRow({
  children,
  lgCols = 4,
  layout = "responsive",
  className = ""
}: DashboardCardRowProps) {
  const grid = LG_COLS[lgCols];
  const responsive =
    `flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] ${grid} lg:snap-none lg:grid lg:overflow-visible lg:pb-0`;
  const scrollOnly = `flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]`;
  return <div className={`min-w-0 ${layout === "scroll" ? scrollOnly : responsive} ${className}`.trim()}>{children}</div>;
}

type DashboardScrollCardProps = {
  children: ReactNode;
  /** Narrow cards (e.g. stat tiles); wide cards (e.g. nav tiles) */
  width?: "stat" | "wide";
  className?: string;
};

export function DashboardScrollCard({ children, width = "stat", className = "" }: DashboardScrollCardProps) {
  const widthClass = width === "wide" ? "w-[min(88vw,300px)]" : "w-[min(88vw,260px)]";
  return (
    <div className={`${widthClass} shrink-0 snap-start lg:w-auto lg:min-w-0 lg:shrink ${className}`.trim()}>{children}</div>
  );
}
