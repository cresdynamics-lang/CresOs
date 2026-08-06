"use client";

import Link from "next/link";
import { SalesCrmToggleBar } from "../sales-workspace-nav";
import { salesNeu } from "../../../components/sales/sales-theme";

/**
 * CRM hub — opened from Sales side panel “CRM”.
 * Toggle buttons switch between Mails, Invoices, Leads, Contacts, Tasks.
 */
export default function SalesCrmHubPage() {
  return (
    <div className={`${salesNeu.workspace} flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6`}>
      <header className="border-b border-[#E1DFDD] pb-4">
        <p className={salesNeu.eyebrow}>Sales · CRM</p>
        <h1 className={`mt-0.5 ${salesNeu.title}`}>CRM</h1>
        <p className={`mt-2 max-w-xl ${salesNeu.body}`}>
          Pick an activity below — mails, invoices, leads, contacts, or tasks — then work in that view.
        </p>
      </header>

      <section className={salesNeu.panel}>
        <p className={salesNeu.sectionTitle}>Activities</p>
        <p className={`mt-1 mb-3 ${salesNeu.muted}`}>Toggle to open a workspace.</p>
        <SalesCrmToggleBar />
      </section>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/sales/messages", title: "Mails", blurb: "Compose and reply to client email." },
          { href: "/sales/invoices", title: "Invoices", blurb: "Sales invoices and payment follow-up." },
          { href: "/leads", title: "Leads", blurb: "Pipeline leads and qualification." },
          { href: "/crm", title: "Contacts", blurb: "Clients and relationship records." },
          { href: "/schedule", title: "Tasks", blurb: "Schedule and delivery tasks." }
        ].map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className={`${salesNeu.listRow} block hover:border-[#005CAB]/50`}
            >
              <p className="text-[13px] font-semibold text-[#242424]">{card.title}</p>
              <p className={`mt-0.5 ${salesNeu.muted}`}>{card.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
