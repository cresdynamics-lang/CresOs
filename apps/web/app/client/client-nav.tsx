"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clientNeu } from "../../components/client/client-theme";

const ITEMS = [
  { href: "/client", label: "Project progress", shortLabel: "Progress", match: "exact" as const },
  { href: "/client/invoices", label: "Invoices", match: "prefix" as const },
  { href: "/client/payments", label: "Payments", match: "prefix" as const },
  { href: "/community", label: "Messages", match: "prefix" as const },
  { href: "/settings/account", label: "Settings", match: "prefix" as const }
];

function isActive(pathname: string, href: string, match: "exact" | "prefix"): boolean {
  if (href === "/settings/account") return pathname.startsWith("/settings");
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ClientNavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    [
      vertical
        ? "min-h-[40px] rounded-lg px-3 py-2 text-[13px] font-medium touch-manipulation"
        : "min-h-[44px] shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap touch-manipulation",
      active ? clientNeu.navActive : clientNeu.navIdle
    ].join(" ");

  if (vertical) {
    return (
      <nav aria-label="Client portal" className="flex flex-col gap-0.5 px-2 py-3">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.match);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Client portal"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.match);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            {item.shortLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ClientNav() {
  return <ClientNavLinks />;
}

export function ClientSideNav() {
  return <ClientNavLinks vertical />;
}
