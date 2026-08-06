"use client";

import Link from "next/link";
import { directorNeu } from "../../../components/director/director-theme";

const ACTIVITIES = [
  { href: "/sales/messages", title: "Mails", blurb: "Compose and reply to client email." },
  { href: "/sales/invoices", title: "Invoices", blurb: "Sales invoices and payment follow-up." },
  { href: "/leads", title: "Leads", blurb: "Pipeline leads and qualification." },
  { href: "/crm", title: "Contacts", blurb: "Clients and relationship records." },
  { href: "/schedule", title: "Tasks", blurb: "Schedule and delivery tasks." }
] as const;

/**
 * Director CRM hub — same activity map as Sales.
 * Prefer opening CRM from the side panel for toggles; this page is for overview quick links / mobile.
 */
export default function DirectorCrmHubPage() {
  return (
    <div className={`${directorNeu.workspace} flex min-h-0 flex-1 flex-col gap-5`}>
      <header className="border-b border-[#E1DFDD] pb-4">
        <p className={directorNeu.eyebrow}>Director · CRM</p>
        <h1 className={`mt-0.5 ${directorNeu.title}`}>CRM</h1>
        <p className={`mt-2 max-w-xl ${directorNeu.body}`}>
          Same map as Sales — mails, invoices, leads, contacts, and tasks. Open CRM in the side panel to toggle
          activities.
        </p>
      </header>

      <section className={directorNeu.panel}>
        <p className={directorNeu.sectionTitle}>Activities</p>
        <p className={`mt-1 mb-3 ${directorNeu.muted}`}>Pick a workspace below.</p>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITIES.map((item) => (
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
        {ACTIVITIES.map((card) => (
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
