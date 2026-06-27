"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { devGlass } from "../../components/developer/developer-glass-theme";

type NavItem = { href: string; label: string; match: "exact" | "prefix" };

const ITEMS: NavItem[] = [
  { href: "/developer", label: "Overview", match: "exact" },
  { href: "/schedule", label: "Tasks", match: "prefix" },
  { href: "/developer-reports", label: "Reports", match: "prefix" },
  { href: "/projects", label: "Projects", match: "prefix" },
  { href: "/community", label: "Community", match: "prefix" }
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function DeveloperNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Developer workspace"
      className={
        vertical
          ? "flex flex-col gap-0.5 px-2 py-2"
          : "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden"
      }
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              vertical
                ? "min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-medium touch-manipulation lg:min-h-0"
                : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation sm:min-h-0",
              active
                ? "border border-violet-400/30 bg-violet-500/15 text-violet-200 backdrop-blur-md"
                : "border border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DeveloperNav() {
  return <DeveloperNavLinks />;
}

export function DeveloperSideNav() {
  return <DeveloperNavLinks vertical />;
}
