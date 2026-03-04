const navItems = [
  "Dashboard",
  "CRM",
  "Projects",
  "Finance",
  "Analytics",
  "Approvals",
  "Settings"
];

const roleDashboards = [
  "Director/Admin",
  "Sales",
  "Ops",
  "Finance",
  "Analyst",
  "Client viewer"
];

export default function HomePage() {
  return (
    <main className="grid gap-6 md:grid-cols-[260px,1fr]">
      <aside className="flex flex-col gap-4">
        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Navigation
          </p>
          <nav className="flex flex-col gap-1">
            {navItems.map((item, idx) => (
              <button
                key={item}
                className={`nav-link ${idx === 0 ? "nav-link-active" : ""}`}
              >
                <span>{item}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="shell">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Role views
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {roleDashboards.map((role) => (
              <div
                key={role}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-slate-200"
              >
                {role}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex flex-col gap-4">
        <div className="shell">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            CresOS narrative
          </p>
          <h1 className="mb-2 text-lg font-semibold text-slate-50">
            Audit & Strategy → Build & Optimize → Automate & Integrate →
            Measure & Scale
          </h1>
          <p className="text-sm text-slate-300">
            CresOS connects visibility → leads → deals → delivery → invoices →
            revenue → analytics in one workflow, so you can run your entire
            service business from a single operating system.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="shell">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Growth pipeline
            </p>
            <ol className="space-y-1 text-sm text-slate-200">
              <li>1. Lead captured in CRM</li>
              <li>2. Deal moves through pipeline stages</li>
              <li>3. Project with milestones & tasks spins up</li>
              <li>4. Invoice generated & approved</li>
              <li>5. Payment reconciled (Mpesa / bank)</li>
              <li>6. KPIs update in real-time dashboards</li>
            </ol>
          </div>

          <div className="shell">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Live OS metrics (sample)
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-400">Leads this week</dt>
                <dd className="text-xl font-semibold text-emerald-400">24</dd>
              </div>
              <div>
                <dt className="text-slate-400">Deals won</dt>
                <dd className="text-xl font-semibold text-emerald-400">7</dd>
              </div>
              <div>
                <dt className="text-slate-400">Revenue received</dt>
                <dd className="text-xl font-semibold text-emerald-400">
                  KES 5,400,000
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Invoices outstanding</dt>
                <dd className="text-xl font-semibold text-amber-400">
                  KES 2,400,000
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Active projects</dt>
                <dd className="text-xl font-semibold text-sky-400">9</dd>
              </div>
              <div>
                <dt className="text-slate-400">Approvals pending</dt>
                <dd className="text-xl font-semibold text-rose-400">3</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}

