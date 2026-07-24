import type { OnboardingAudience } from "./onboarding-role-scope";

export type OnboardingContactRule = {
  id: string;
  when: string;
  goTo: string;
  roleHint: string;
};

export type OnboardingPlaybook = {
  audience: OnboardingAudience;
  title: string;
  summary: string;
  expectations: string[];
  contactRules: OnboardingContactRule[];
  suggestedQuestions: string[];
  dailyRhythm: string[];
};

const PLAYBOOKS: Record<OnboardingAudience, OnboardingPlaybook> = {
  developer: {
    audience: "developer",
    title: "Developer — Cres Dynamics",
    summary:
      "You deliver assigned project work, file daily reports, and keep tasks moving. You do not invent scope — PM and Sales own client commitments.",
    expectations: [
      "Own your assigned tasks and update status in CresOS (todo → in progress → done).",
      "Submit a daily developer report covering what you did, blockers, and next steps.",
      "Respect estimate hours and milestone dates set by Project Management.",
      "Use Community for quick team questions; escalate blockers early — do not wait until standup fails.",
      "Never promise clients new features or dates; route those to Sales / PM."
    ],
    contactRules: [
      {
        id: "dev-blocker",
        when: "You are blocked on a task or unclear acceptance criteria",
        goTo: "Your Project Manager (PM workspace check-ins / Community)",
        roleHint: "project_manager"
      },
      {
        id: "dev-scope",
        when: "A client asks for new work or a date change",
        goTo: "Sales (pipeline owner) and copy the Project Manager",
        roleHint: "sales"
      },
      {
        id: "dev-access",
        when: "You need repo, hosting, or tool access",
        goTo: "Admin (users / org) or your PM",
        roleHint: "admin"
      },
      {
        id: "dev-pay",
        when: "You have a question about contractor payment or expense reimbursement",
        goTo: "Finance (then Admin approval if needed)",
        roleHint: "finance"
      },
      {
        id: "dev-hr",
        when: "Leave, profile, or people ops questions",
        goTo: "HR",
        roleHint: "hr"
      }
    ],
    suggestedQuestions: [
      "What is expected of me as a developer at Cres Dynamics?",
      "Who do I talk to when I am blocked?",
      "How do daily reports work?",
      "How should I use the schedule / tasks board?",
      "What happens when a milestone is due?"
    ],
    dailyRhythm: [
      "Check Schedule / Tasks for today",
      "Work assigned project tasks",
      "Respond to PM check-ins",
      "File developer report before end of day"
    ]
  },
  sales: {
    audience: "sales",
    title: "Sales — Cres Dynamics",
    summary:
      "You own pipeline: leads, CRM, proposals, and client communication. Delivery is PM + Developers; money is Finance.",
    expectations: [
      "Capture and update every lead and deal stage in CresOS CRM.",
      "File sales reports so Directors see pipeline truth.",
      "Create or update projects with accurate client and commercial context.",
      "Do not silently change delivery scope — involve PM when clients change requirements.",
      "Coordinate invoices with Finance; do not mark cash as received yourself unless Finance confirms."
    ],
    contactRules: [
      {
        id: "sales-delivery",
        when: "Client asks about delivery timelines, milestones, or blockers",
        goTo: "Project Manager",
        roleHint: "project_manager"
      },
      {
        id: "sales-money",
        when: "Client paid or disputes an invoice",
        goTo: "Finance (record payment / invoice status)",
        roleHint: "finance"
      },
      {
        id: "sales-approval",
        when: "A new project needs director approval",
        goTo: "Director",
        roleHint: "director"
      },
      {
        id: "sales-admin",
        when: "Client portal users or org access issues",
        goTo: "Admin",
        roleHint: "admin"
      },
      {
        id: "sales-tech",
        when: "You need a technical feasibility answer for a proposal",
        goTo: "PM first, then a Developer if PM assigns",
        roleHint: "project_manager"
      }
    ],
    suggestedQuestions: [
      "What is expected of me in Sales at Cres Dynamics?",
      "When a client pays, who do I notify?",
      "How do leads become projects?",
      "Who approves new projects?",
      "What should I put in a sales report?"
    ],
    dailyRhythm: [
      "Review leads & CRM stages",
      "Follow up outstanding proposals",
      "Sync with PM on active client asks",
      "Update sales report / pipeline notes"
    ]
  },
  director: {
    audience: "director",
    title: "Director — Cres Dynamics",
    summary:
      "You govern the business: approvals, risk, pipeline health, and people outcomes. You do not replace PM day-to-day delivery or Finance ledger work.",
    expectations: [
      "Review and approve (or reject) projects, key expenses, and escalations.",
      "Read director briefings / AI summaries and act on at-risk signals.",
      "Hold Sales accountable for pipeline accuracy and Finance for cash truth.",
      "Escalate structural org issues to Admin; people issues to HR.",
      "Protect delivery quality — intervene when health scores stay critical."
    ],
    contactRules: [
      {
        id: "dir-delivery",
        when: "A project is at risk or overdue on milestones",
        goTo: "Project Manager (with Sales if commercial)",
        roleHint: "project_manager"
      },
      {
        id: "dir-cash",
        when: "Cash flow, unpaid invoices, or expense spikes",
        goTo: "Finance",
        roleHint: "finance"
      },
      {
        id: "dir-pipeline",
        when: "Pipeline looks thin or deals stall",
        goTo: "Sales",
        roleHint: "sales"
      },
      {
        id: "dir-people",
        when: "Hiring, performance, or leave policy",
        goTo: "HR",
        roleHint: "hr"
      },
      {
        id: "dir-system",
        when: "Roles, access, or platform configuration",
        goTo: "Admin",
        roleHint: "admin"
      }
    ],
    suggestedQuestions: [
      "What is expected of me as a Director?",
      "What should I approve vs delegate?",
      "Who owns delivery risk day to day?",
      "How do I read project health?",
      "When should I escalate to Admin?"
    ],
    dailyRhythm: [
      "Scan command center / analytics",
      "Clear pending approvals",
      "Review at-risk projects with PM",
      "Check director / AI briefings"
    ]
  },
  project_manager: {
    audience: "project_manager",
    title: "Project Manager — Cres Dynamics",
    summary:
      "You own delivery: milestones, tasks, check-ins, and knowledge. Sales owns commercial promises; Developers execute tasks.",
    expectations: [
      "Keep project details, success criteria, milestones, and tasks current.",
      "Run daily developer check-ins and unblock the team.",
      "Use the knowledge pool to stay aligned with actions across CresOS.",
      "Flag commercial scope changes to Sales; flag budget/payment issues to Finance.",
      "Escalate chronic risk to the Director — do not hide red health scores."
    ],
    contactRules: [
      {
        id: "pm-dev",
        when: "A developer is blocked or behind on tasks",
        goTo: "That Developer (check-in), then redistribute work if needed",
        roleHint: "developer"
      },
      {
        id: "pm-sales",
        when: "Client changes scope, deadline, or acceptance criteria",
        goTo: "Sales (commercial) and update the plan",
        roleHint: "sales"
      },
      {
        id: "pm-finance",
        when: "Payment milestone or invoice timing affects delivery",
        goTo: "Finance",
        roleHint: "finance"
      },
      {
        id: "pm-dir",
        when: "Project health is critical or client escalation",
        goTo: "Director",
        roleHint: "director"
      },
      {
        id: "pm-admin",
        when: "Team access, invites, or org structure issues",
        goTo: "Admin",
        roleHint: "admin"
      }
    ],
    suggestedQuestions: [
      "What is expected of me as a Project Manager?",
      "How do check-ins work?",
      "When do I escalate to the Director?",
      "How should I use the knowledge pool?",
      "Who owns client commercial changes?"
    ],
    dailyRhythm: [
      "Review project health / priorities",
      "Send or review developer check-ins",
      "Update milestones & tasks",
      "Sync Sales on client asks; Finance on payment blockers"
    ]
  },
  hr: {
    audience: "hr",
    title: "HR — Cres Dynamics",
    summary:
      "You own people operations: roster, readiness, payroll inputs, and onboarding culture. You do not own project delivery or ledger confirmation.",
    expectations: [
      "Keep employee profiles, roles, and managers accurate.",
      "Drive profile completion / onboarding readiness for new joiners.",
      "Coordinate payroll figures with Finance — do not invent payments.",
      "Protect confidentiality — share people data only with those who need it.",
      "Partner with Directors on org health; Admin on access and roles."
    ],
    contactRules: [
      {
        id: "hr-finance",
        when: "Salary, stipend, or payroll expense needs recording",
        goTo: "Finance (Admin approval may follow)",
        roleHint: "finance"
      },
      {
        id: "hr-admin",
        when: "A new hire needs a CresOS account or role change",
        goTo: "Admin",
        roleHint: "admin"
      },
      {
        id: "hr-dir",
        when: "Performance, restructuring, or sensitive people decisions",
        goTo: "Director",
        roleHint: "director"
      },
      {
        id: "hr-pm",
        when: "A developer’s capacity or leave impacts delivery",
        goTo: "Project Manager",
        roleHint: "project_manager"
      },
      {
        id: "hr-sales",
        when: "A sales hire needs CRM / pipeline orientation",
        goTo: "Sales lead + this Onboarding AI for role expectations",
        roleHint: "sales"
      }
    ],
    suggestedQuestions: [
      "What is expected of me in HR at Cres Dynamics?",
      "How do I onboard a new employee?",
      "Who creates user accounts?",
      "How does payroll sync with Finance?",
      "Who do I escalate sensitive people issues to?"
    ],
    dailyRhythm: [
      "Review workforce / profile completion",
      "Update employee records",
      "Coordinate payroll notes with Finance",
      "Support new joiners via Onboarding guidance"
    ]
  },
  finance: {
    audience: "finance",
    title: "Finance — Cres Dynamics",
    summary:
      "You own money truth: invoices, payments, expenses, and project received amounts. Expenses need Admin approval; delivery stays with PM.",
    expectations: [
      "Record expenses and payments accurately (Finance AI or finance console).",
      "Submit expenses for admin approval — do not treat pending as paid.",
      "Link client payments to invoices; create invoices when missing for a project.",
      "Keep project amount-received in sync with confirmed payments.",
      "Never invent commercial terms — confirm with Sales when unclear."
    ],
    contactRules: [
      {
        id: "fin-admin",
        when: "An expense needs approval",
        goTo: "Admin",
        roleHint: "admin"
      },
      {
        id: "fin-sales",
        when: "Invoice amount or client commercial terms are unclear",
        goTo: "Sales",
        roleHint: "sales"
      },
      {
        id: "fin-pm",
        when: "Payment milestone relates to delivery progress",
        goTo: "Project Manager",
        roleHint: "project_manager"
      },
      {
        id: "fin-dir",
        when: "Cash risk, large write-offs, or governance exceptions",
        goTo: "Director",
        roleHint: "director"
      },
      {
        id: "fin-hr",
        when: "Salary / people-cost questions",
        goTo: "HR (then record via Finance)",
        roleHint: "hr"
      }
    ],
    suggestedQuestions: [
      "What is expected of me in Finance?",
      "How do expense approvals work?",
      "What if a client pays but there is no invoice?",
      "Who do I ask about project commercial terms?",
      "How does Finance AI record payments?"
    ],
    dailyRhythm: [
      "Clear pending expenses / approvals follow-ups",
      "Record payments against invoices",
      "Check clients-due / project balances",
      "Use Finance AI for voice/text entries when faster"
    ]
  },
  admin: {
    audience: "admin",
    title: "Admin — Cres Dynamics",
    summary:
      "You see the whole operating system: users, roles, AI command, email automation, and cross-role escalations. Prefer routing work to the owning role when possible.",
    expectations: [
      "Maintain users, roles, and org structure.",
      "Approve finance expenses and structural changes when required.",
      "Use Admin AI Command for meetings/tasks and org intelligence.",
      "Protect access — least privilege per role.",
      "Coordinate with Directors on governance; do not replace PM delivery ownership."
    ],
    contactRules: [
      {
        id: "admin-fin",
        when: "Ledger, invoice, or payment detail is needed",
        goTo: "Finance",
        roleHint: "finance"
      },
      {
        id: "admin-pm",
        when: "Delivery status or milestone truth is needed",
        goTo: "Project Manager",
        roleHint: "project_manager"
      },
      {
        id: "admin-sales",
        when: "Client commercial or pipeline truth is needed",
        goTo: "Sales",
        roleHint: "sales"
      },
      {
        id: "admin-hr",
        when: "People roster or payroll inputs",
        goTo: "HR",
        roleHint: "hr"
      },
      {
        id: "admin-dir",
        when: "Strategic or approval governance decisions",
        goTo: "Director",
        roleHint: "director"
      }
    ],
    suggestedQuestions: [
      "What can Admin see that other roles cannot?",
      "How should I approve expenses?",
      "How do I onboard a new user into the right role?",
      "When should I use Admin AI Command vs Onboarding?",
      "How does the knowledge pool get updated?"
    ],
    dailyRhythm: [
      "Review users / roles / pending approvals",
      "Scan Admin AI Command / activity",
      "Clear structural escalations",
      "Ensure new joiners have roles + Onboarding access"
    ]
  }
};

export function getOnboardingPlaybook(audience: OnboardingAudience): OnboardingPlaybook {
  return PLAYBOOKS[audience];
}

export function listOnboardingAudiences(): OnboardingAudience[] {
  return Object.keys(PLAYBOOKS) as OnboardingAudience[];
}
