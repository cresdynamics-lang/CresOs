"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

type StressTone = "gold" | "violet" | "sky" | "emerald" | "rose";

function Stress({ children, tone = "gold" }: { children: ReactNode; tone?: StressTone }) {
  const tones: Record<StressTone, string> = {
    gold: "text-amber-300 decoration-amber-400",
    violet: "text-violet-300 decoration-violet-400",
    sky: "text-sky-300 decoration-sky-400",
    emerald: "text-emerald-300 decoration-emerald-400",
    rose: "text-rose-300 decoration-rose-400"
  };
  return (
    <span className={`font-bold underline decoration-2 underline-offset-[5px] ${tones[tone]}`}>
      {children}
    </span>
  );
}

const FEATURE_CARDS: { title: string; body: ReactNode; accent: StressTone }[] = [
  {
    title: "Operations & workflow",
    accent: "violet",
    body: (
      <>
        <Stress tone="violet">Projects</Stress>, <Stress tone="gold">approvals</Stress>, and performance — who owns
        what, what&apos;s stuck, how teams perform. <Stress tone="emerald">Clear operations</Stress>, no blind spots.
      </>
    )
  },
  {
    title: "Finance & revenue",
    accent: "gold",
    body: (
      <>
        <Stress tone="gold">Revenue visibility</Stress>, invoice management, and payment tracking. One{" "}
        <Stress tone="sky">finance layer</Stress> across your entire business.
      </>
    )
  },
  {
    title: "CRM & leads",
    accent: "sky",
    body: (
      <>
        <Stress tone="sky">Leads, deals</Stress>, and client relationships in one place. Pipeline stages, follow-ups,
        and <Stress tone="violet">AI-assisted reminders</Stress> so nothing slips.
      </>
    )
  },
  {
    title: "Analytics & reports",
    accent: "emerald",
    body: (
      <>
        Dashboards, developer reports, and KPIs. Know your numbers in{" "}
        <Stress tone="emerald">real time</Stress> — not just at month end.
      </>
    )
  },
  {
    title: "AI & automation",
    accent: "violet",
    body: (
      <>
        Automated follow-ups, workflow triggers, and reminder emails.{" "}
        <Stress tone="violet">Less manual work</Stress>, <Stress tone="gold">consistent execution</Stress>.
      </>
    )
  },
  {
    title: "Role-based access",
    accent: "rose",
    body: (
      <>
        Director, admin, sales, finance, developer, HR — each role sees{" "}
        <Stress tone="rose">what they need</Stress>. Audit trails and governance built in.
      </>
    )
  }
];

const PIPELINE_STEPS: { step: string; stress: ReactNode }[] = [
  {
    step: "Lead captured in CRM",
    stress: (
      <>
        <Stress tone="sky">Lead</Stress> captured
      </>
    )
  },
  {
    step: "Deal moves through pipeline stages",
    stress: (
      <>
        <Stress tone="violet">Deal</Stress> advances
      </>
    )
  },
  {
    step: "Project with milestones & tasks spins up",
    stress: (
      <>
        <Stress tone="emerald">Project</Stress> goes live
      </>
    )
  },
  {
    step: "Invoice generated & approved",
    stress: (
      <>
        <Stress tone="gold">Invoice</Stress> issued
      </>
    )
  },
  {
    step: "Payment reconciled (M-Pesa / bank)",
    stress: (
      <>
        <Stress tone="sky">Payment</Stress> recorded
      </>
    )
  },
  {
    step: "KPIs update in real-time dashboards",
    stress: (
      <>
        <Stress tone="emerald">KPIs</Stress> refresh
      </>
    )
  }
];

const PLATFORM_PILLARS = [
  { label: "CRM & pipeline", tone: "sky" as StressTone },
  { label: "Projects & delivery", tone: "violet" as StressTone },
  { label: "Finance & payroll", tone: "gold" as StressTone },
  { label: "HR & workforce", tone: "rose" as StressTone },
  { label: "Leadership & AI", tone: "emerald" as StressTone },
  { label: "Community & messaging", tone: "sky" as StressTone }
];

const DETAIL_SECTIONS = [
  {
    title: "How the pieces connect",
    body: (
      <>
        A lead lands in CRM. It becomes a deal, then a <Stress tone="emerald">live project</Stress> with milestones,
        developers, and daily reports. Finance invoices from the same client record; payments reconcile via{" "}
        <Stress tone="sky">M-Pesa</Stress> or bank. HR feeds payroll and workforce charts —{" "}
        <Stress tone="gold">one database</Stress>, one truth.
      </>
    )
  },
  {
    title: "Workspaces for every role",
    body: (
      <>
        Admin, director, sales, finance, developer, HR, and client portal — sign in once, land in the workspace built
        for your role, with <Stress tone="violet">live data</Stress> scoped to your job.
      </>
    )
  }
];

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-sky-600 px-7 py-3.5 font-label text-sm font-semibold tracking-wide text-white shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-sky-500 hover:shadow-violet-800/50";

const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-7 py-3.5 font-label text-sm font-semibold tracking-wide text-slate-100 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10";

export default function LandingPage() {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-body text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent)]" aria-hidden />

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0a0a0c]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-display text-lg font-bold tracking-tight">
            <img src="/LOGO.jpg" width={40} height={40} alt="" className="h-10 w-10 rounded-xl ring-1 ring-white/10" />
            CresOS
          </Link>
          <Link href="/login" className={`${btnPrimary} !px-5 !py-2.5 text-xs sm:text-sm`}>
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero — centered */}
      <section className="relative mx-auto max-w-3xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pb-20 sm:pt-24">
        <p
          className="animate-fade-in font-label text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/90 opacity-0 sm:text-xs"
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
        >
          Cres Dynamics — Business Operating System &amp; CRM
        </p>

        <h1
          className="font-display mt-6 animate-slide-in-bottom text-4xl font-bold leading-[1.1] tracking-tight opacity-0 sm:text-5xl lg:text-[3.25rem]"
          style={{ animationDelay: "80ms", animationFillMode: "forwards" }}
        >
          <span className="bg-gradient-to-br from-white via-white to-slate-400 bg-clip-text text-transparent">
            CresOS
          </span>
          <span className="mt-3 block text-[0.88em] font-semibold text-slate-200">
            The Complete Business Operating System with Integrated CRM
          </span>
        </h1>

        <p
          className="mx-auto mt-8 max-w-2xl animate-slide-in-bottom text-base leading-relaxed text-slate-400 opacity-0 sm:text-lg sm:leading-relaxed"
          style={{ animationDelay: "160ms", animationFillMode: "forwards" }}
        >
          <Stress tone="gold">CresOS</Stress> by Cres Dynamics is the all-in-one platform that connects your{" "}
          <Stress tone="sky">CRM</Stress>, <Stress tone="violet">project management</Stress>,{" "}
          <Stress tone="gold">finance</Stress>, and <Stress tone="emerald">analytics</Stress>. Kenya&apos;s leading
          business management software for growing companies. When you&apos;ve outgrown WhatsApp and Excel,{" "}
          <Stress tone="rose">this is what comes next</Stress>.
        </p>

        <div
          className="mt-10 flex animate-slide-in-bottom flex-wrap items-center justify-center gap-4 opacity-0"
          style={{ animationDelay: "240ms", animationFillMode: "forwards" }}
        >
          <Link href="/login" className={btnPrimary}>
            Sign in to CresOS
            <span aria-hidden>→</span>
          </Link>
          <button type="button" onClick={() => setShowMore((v) => !v)} className={btnSecondary} aria-expanded={showMore}>
            {showMore ? "Show less" : "Learn more"}
          </button>
        </div>
      </section>

      {/* Section 1 — What CresOS does (always visible) */}
      <section className="border-t border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <p className="font-label text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-300/90">
            What CresOS Does
          </p>
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-2xl font-bold leading-snug text-white sm:text-3xl">
            <Stress tone="violet">Visibility</Stress> → leads → deals → delivery → invoices → revenue →{" "}
            <Stress tone="emerald">analytics</Stress> — one workflow.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
            The <Stress tone="gold">operating system</Stress> for teams that sell work and ship projects — not another
            disconnected app on the pile.
          </p>

          <div className="mt-14 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-sm transition hover:border-white/14 hover:bg-white/[0.06] sm:p-7"
              >
                <h3 className="font-display text-center text-lg font-bold text-white">{card.title}</h3>
                <p className="mt-4 text-center text-sm leading-relaxed text-slate-400">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 — Growth pipeline (always visible) */}
      <section className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 sm:py-24">
        <p className="font-label text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300/90">
          Growth Pipeline
        </p>
        <h2 className="font-display mx-auto mt-4 max-w-2xl text-2xl font-bold text-white sm:text-3xl">
          Run your entire service business from a{" "}
          <Stress tone="sky">single operating system</Stress>.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-sm text-slate-400 sm:text-base">
          From first contact to <Stress tone="gold">paid invoice</Stress> — every step lives inside CresOS.
        </p>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STEPS.map(({ step, stress }, i) => (
            <li
              key={step}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-6 text-center backdrop-blur-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/30 to-sky-600/30 font-label text-sm font-bold text-violet-200 ring-1 ring-white/10">
                {i + 1}
              </span>
              <p className="font-display text-sm font-semibold text-white">{stress}</p>
              <p className="text-xs leading-relaxed text-slate-500">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Learn more — extra depth */}
      {showMore ? (
        <section className="border-t border-white/[0.06] bg-white/[0.02]">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-20">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
              Platform depth
            </p>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {PLATFORM_PILLARS.map(({ label, tone }) => (
                <li
                  key={label}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 font-label text-xs font-medium text-slate-300"
                >
                  <Stress tone={tone}>{label}</Stress>
                </li>
              ))}
            </ul>
            <div className="mt-14 space-y-12">
              {DETAIL_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="font-display text-xl font-bold text-white">{section.title}</h3>
                  <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">{section.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <p className="font-label text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Cres Dynamics · Nairobi, Kenya
          </p>
          <h2 className="font-display mt-4 text-2xl font-bold text-white sm:text-3xl">
            Ready to run your business on <Stress tone="gold">one system</Stress>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
            Sign in with your Cres Dynamics account to open your{" "}
            <Stress tone="violet">role-based workspace</Stress>.
          </p>
          <Link href="/login" className={`${btnPrimary} mt-10`}>
            Sign in to CresOS
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 text-center font-label text-xs text-slate-600 sm:px-8">
          <p>CresOS — Operating System for Growth</p>
          <p>
            Built by{" "}
            <a
              href="https://cresdynamics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-300/80 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-200"
            >
              Cres Dynamics
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
