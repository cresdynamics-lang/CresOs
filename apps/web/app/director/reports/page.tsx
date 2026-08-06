"use client";

import Link from "next/link";
import { directorNeu } from "../../../components/director/director-theme";

const REPORT_TOGGLES = [
  { href: "/reports", title: "Sales", blurb: "Sales report threads and submissions." },
  { href: "/developer-reports", title: "Developers", blurb: "Developer delivery reports." },
  { href: "/reports/ai", title: "AI summaries", blurb: "AI briefings and report digests." }
] as const;

/**
 * Director Reports hub — Sales · Developers · AI.
 * Prefer the side-panel Reports drill-in for toggles.
 */
export default function DirectorReportsHubPage() {
  return (
    <div className={`${directorNeu.workspace} flex min-h-0 flex-1 flex-col gap-5`}>
      <header className="border-b border-[#E1DFDD] pb-4">
        <p className={directorNeu.eyebrow}>Director · Reports</p>
        <h1 className={`mt-0.5 ${directorNeu.title}`}>Reports</h1>
        <p className={`mt-2 max-w-xl ${directorNeu.body}`}>
          Toggle Sales, Developer, or AI summaries. Open Reports in the side panel for the same activities.
        </p>
      </header>

      <section className={directorNeu.panel}>
        <p className={directorNeu.sectionTitle}>Report types</p>
        <p className={`mt-1 mb-3 ${directorNeu.muted}`}>Choose a view.</p>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_TOGGLES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-h-[36px] rounded-md border border-[#D1D1D1] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#242424] transition-colors hover:border-[#005CAB]/40 hover:text-[#005CAB]"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </section>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TOGGLES.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className={`${directorNeu.listRow} block hover:border-[#005CAB]/50`}>
              <p className="text-[13px] font-semibold text-[#242424]">{card.title}</p>
              <p className={`mt-0.5 ${directorNeu.muted}`}>{card.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
