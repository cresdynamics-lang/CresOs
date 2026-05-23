"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type HoverSidebarItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

export type HoverSidebarSection = {
  title: string;
  items: HoverSidebarItem[];
};

type CollapsibleHoverSidebarProps = {
  header?: ReactNode;
  footer?: ReactNode;
  sections?: HoverSidebarSection[];
  items?: HoverSidebarItem[];
  className?: string;
};

const labelReveal =
  "min-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 w-0 transition-all duration-200 ease-out group-hover/hover-nav:ml-2 group-hover/hover-nav:w-auto group-hover/hover-nav:opacity-100";

const sectionTitleReveal =
  "mb-0 h-0 overflow-hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 opacity-0 transition-all duration-200 group-hover/hover-nav:mb-2 group-hover/hover-nav:h-auto group-hover/hover-nav:opacity-100";

export function CollapsibleHoverSidebar({
  header,
  footer,
  sections,
  items,
  className = ""
}: CollapsibleHoverSidebarProps) {
  const renderItem = (item: HoverSidebarItem) => (
    <Link
      key={item.href}
      href={item.href}
      title={item.label}
      className={`flex items-center rounded-lg px-2 py-2 transition-colors ${
        item.active
          ? "border border-brand/40 bg-brand/15 text-brand"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800/90 text-xs font-semibold text-slate-200">
        {item.icon}
      </span>
      <span className={labelReveal}>{item.label}</span>
    </Link>
  );

  return (
    <aside
      className={`group/hover-nav flex h-full w-[4.25rem] shrink-0 flex-col overflow-x-hidden border-r border-slate-800 bg-slate-950/90 transition-[width] duration-200 ease-out hover:w-56 ${className}`}
    >
      {header ? <div className="shrink-0 border-b border-slate-800 px-2 py-3">{header}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {sections?.map((section) => (
          <div key={section.title} className="mb-4 last:mb-0">
            <p className={sectionTitleReveal}>{section.title}</p>
            <nav className="flex flex-col gap-0.5">{section.items.map(renderItem)}</nav>
          </div>
        ))}
        {items?.length ? <nav className="flex flex-col gap-0.5">{items.map(renderItem)}</nav> : null}
      </div>
      {footer ? <div className="shrink-0 border-t border-slate-800 p-2">{footer}</div> : null}
    </aside>
  );
}
