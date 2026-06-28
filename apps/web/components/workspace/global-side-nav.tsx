"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GlobalNavSection } from "../../lib/global-nav-sections";

export type NavBadge = { count: number; tone: "rose" | "amber" | "sky" };

type GlobalSideNavProps = {
  sections: GlobalNavSection[];
  badgeForItem?: (href: string, label: string) => NavBadge | null;
  communityChatUnread?: number;
  onNavClick?: () => void;
};

function isNavActive(pathname: string, href: string, communityChatUnread: number): boolean {
  if (href === "/finance") return pathname.startsWith("/finance") || pathname.startsWith("/approvals");
  if (href === "/sales") return pathname.startsWith("/sales") || pathname.startsWith("/leads") || pathname.startsWith("/crm");
  if (href === "/admin/users") return pathname.startsWith("/admin");
  if (href === "/community" && communityChatUnread > 0 && !pathname.startsWith("/community")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const badgeToneClass: Record<NavBadge["tone"], string> = {
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500"
};

export function GlobalSideNav({
  sections,
  badgeForItem,
  communityChatUnread = 0,
  onNavClick
}: GlobalSideNavProps) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    [
      "flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-medium touch-manipulation lg:min-h-0",
      active
        ? "border border-brand/30 bg-brand/10 text-brand"
        : "border border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
    ].join(" ");

  return (
    <nav aria-label="App navigation" className="flex flex-col gap-4 px-2 py-3">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isNavActive(pathname, item.href, communityChatUnread);
              const badge = badgeForItem?.(item.href, item.label);
              return (
                <Link
                  key={`${section.title}-${item.href}`}
                  href={item.href}
                  onClick={() => onNavClick?.()}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  <span className="truncate">{item.label}</span>
                  {badge ? (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${badgeToneClass[badge.tone]}`}
                    >
                      {badge.count > 99 ? "99+" : badge.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
