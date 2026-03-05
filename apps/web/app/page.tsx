"use client";

import Link from "next/link";

const FEATURE_CARDS = [
  {
    title: "Operations & workflow",
    body: "Projects, approvals, performance. Who owns what, what's stuck, how teams perform. Clear operations, no blind spots.",
    direction: "top" as const,
    delay: 0
  },
  {
    title: "Finance & revenue",
    body: "Revenue visibility, invoice management, subscription billing, payment tracking. One finance layer across your business.",
    direction: "right" as const,
    delay: 1
  },
  {
    title: "CRM & leads",
    body: "Leads, deals, and client relationships in one place. Pipeline stages, follow-ups, and AI-assisted reminders so nothing slips.",
    direction: "bottom" as const,
    delay: 2
  },
  {
    title: "Analytics & reports",
    body: "Dashboards, developer reports, and KPIs. Know your numbers in real time—not just at month end.",
    direction: "left" as const,
    delay: 3
  },
  {
    title: "AI & automation",
    body: "Automated follow-ups, workflow triggers, curated client messages, and reminder emails. Less manual work, consistent execution.",
    direction: "top" as const,
    delay: 4
  },
  {
    title: "Role-based access",
    body: "Director, admin, sales, finance, developer, analyst—each role sees what they need. Audit trails and governance built in.",
    direction: "right" as const,
    delay: 5
  }
];

const PIPELINE_STEPS = [
  "Lead captured in CRM",
  "Deal moves through pipeline stages",
  "Project with milestones & tasks spins up",
  "Invoice generated & approved",
  "Payment reconciled (Mpesa / bank)",
  "KPIs update in real-time dashboards"
];

function cardAnimation(direction: string, delay: number) {
  const anim = {
    top: "animate-slide-in-top",
    bottom: "animate-slide-in-bottom",
    left: "animate-slide-in-left",
    right: "animate-slide-in-right"
  }[direction] || "animate-fade-in";
  const style = { animationDelay: `${delay * 100}ms` };
  return { anim, style };
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cres-bg text-cres-text font-body">
      {/* Top bar */}
      <header className="border-b border-cres-border bg-cres-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-lg font-semibold tracking-tight text-cres-text">
            CresOS
          </span>
          <Link
            href="/login"
            className="rounded-lg bg-cres-accent px-4 py-2 font-label text-sm font-medium text-cres-bg hover:bg-cres-accent-hover transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32">
        <p
          className="mb-4 font-label text-sm font-medium uppercase tracking-wider text-cres-accent opacity-0 animate-fade-in"
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
        >
          Business Operating System
        </p>
        <h1
          className="font-display mb-8 max-w-3xl text-4xl font-bold tracking-tight text-cres-text opacity-0 animate-slide-in-bottom sm:text-5xl lg:text-6xl"
          style={{ animationDelay: "80ms", animationFillMode: "forwards" }}
        >
          One platform. Identity, operations, finance, clients, analytics.
        </h1>
        <p
          className="mb-12 max-w-2xl text-lg leading-relaxed text-cres-text-muted opacity-0 animate-slide-in-bottom"
          style={{ animationDelay: "160ms", animationFillMode: "forwards" }}
        >
          CresOS is the infrastructure that lets your business run without you in every decision.
          Modular, role-based, built on the Cres Core Engine. When you&apos;ve outgrown WhatsApp and Excel, this is what comes next.
        </p>
        <div
          className="flex flex-wrap gap-4 opacity-0 animate-slide-in-bottom"
          style={{ animationDelay: "240ms", animationFillMode: "forwards" }}
        >
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-cres-accent px-6 py-3.5 font-label text-sm font-medium text-cres-bg shadow-lg shadow-cres-accent/20 hover:bg-cres-accent-hover transition-colors animate-bounce-soft"
          >
            Sign in to CresOS
          </Link>
          <a
            href="https://cresdynamics.com/cresos/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border border-cres-border bg-cres-card px-6 py-3.5 font-label text-sm font-medium text-cres-text hover:bg-cres-surface hover:border-cres-muted transition-colors"
          >
            Learn more
          </a>
        </div>
      </section>

      {/* What it does */}
      <section className="border-t border-cres-border bg-cres-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="font-label mb-3 text-sm font-medium uppercase tracking-wider text-cres-accent">
            What CresOS does
          </p>
          <p className="font-display mb-16 max-w-2xl text-2xl font-semibold leading-snug text-cres-text sm:text-3xl">
            Connects visibility → leads → deals → delivery → invoices → revenue → analytics in one workflow.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((card, i) => {
              const { anim, style } = cardAnimation(card.direction, card.delay);
              return (
                <div
                  key={card.title}
                  className={`rounded-2xl border border-cres-border bg-cres-card p-6 opacity-0 ${anim} sm:p-8`}
                  style={{ ...style, animationFillMode: "forwards" }}
                >
                  <h3 className="font-display mb-3 text-lg font-semibold text-cres-text">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-cres-text-muted">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="font-label mb-3 text-sm font-medium uppercase tracking-wider text-cres-accent">
          Growth pipeline
        </p>
        <p className="font-display mb-14 text-xl font-semibold text-cres-text sm:text-2xl">
          Run your entire service business from a single operating system.
        </p>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STEPS.map((step, i) => {
            const fromLeft = i % 2 === 0;
            const anim = fromLeft ? "animate-slide-in-left" : "animate-slide-in-right";
            return (
              <li
                key={step}
                className={`flex items-start gap-4 rounded-xl border border-cres-border bg-cres-card px-5 py-4 opacity-0 ${anim}`}
                style={{
                  animationDelay: `${i * 80}ms`,
                  animationFillMode: "forwards"
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cres-accent/20 font-label text-sm font-semibold text-cres-accent">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-cres-text-muted">{step}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* CTA */}
      <section className="border-t border-cres-border bg-cres-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="font-label mb-2 text-sm font-medium uppercase tracking-wider text-cres-muted">
            Cres Dynamics · Nairobi, Kenya
          </p>
          <h2 className="font-display mb-5 text-2xl font-bold text-cres-text sm:text-3xl">
            Ready to run your business on one system?
          </h2>
          <p className="mb-10 max-w-xl leading-relaxed text-cres-text-muted">
            Sign in with your Cres Dynamics account to access your role-based workspace.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-cres-accent px-6 py-3.5 font-label text-sm font-medium text-cres-bg shadow-lg shadow-cres-accent/20 hover:bg-cres-accent-hover transition-colors animate-bounce-soft"
          >
            Sign in to CresOS
          </Link>
        </div>
      </section>

      <footer className="border-t border-cres-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-center font-label text-xs text-cres-muted sm:px-6">
          CresOS – Operating System for Growth · Built on Cres Core Engine
        </div>
      </footer>
    </div>
  );
}
