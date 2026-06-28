"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [{ href: "/client", label: "My projects", match: "exact" as const }];

function isActive(pathname: string, href: string, match: "exact" | "prefix"): boolean {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ClientNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Client portal"
      className={vertical ? "flex flex-col gap-0.5 px-2 py-3" : "flex gap-2 overflow-x-auto pb-1"}
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              vertical
                ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium touch-manipulation"
                : "shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation",
              active
                ? "border border-teal-500/30 bg-teal-950/40 text-teal-200"
                : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ClientSideNav() {
  return <ClientNavLinks vertical />;
}
