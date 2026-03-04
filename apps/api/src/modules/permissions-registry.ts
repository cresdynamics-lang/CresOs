export type PermissionDef = {
  key: string;
  description: string;
};

export const PERMISSIONS: PermissionDef[] = [
  // Finance
  {
    key: "finance.read",
    description: "View invoices, payments, expenses, payouts"
  },
  {
    key: "finance.create_invoice",
    description: "Create invoices"
  },
  {
    key: "finance.record_payment",
    description: "Record incoming payments"
  },
  {
    key: "finance.record_expense",
    description: "Record expenses"
  },
  {
    key: "finance.create_payout",
    description: "Create payout requests"
  },
  {
    key: "finance.approval_request",
    description: "Request financial approvals"
  },
  {
    key: "finance.approval_decide",
    description: "Decide on financial approvals"
  },
  // Projects / Ops
  {
    key: "projects.read",
    description: "View projects, milestones, tasks"
  },
  {
    key: "projects.manage",
    description: "Create and manage projects, milestones, tasks"
  },
  // Sales / CRM
  {
    key: "crm.read",
    description: "View clients, leads, deals"
  },
  {
    key: "crm.manage",
    description: "Create and manage clients, leads, deals"
  },
  // Director
  {
    key: "director.dashboard",
    description: "Access Director strategic dashboard"
  },
  {
    key: "director.approvals",
    description: "View and decide Director approvals"
  },
  {
    key: "director.risks",
    description: "Manage risk register"
  },
  {
    key: "director.projects_control",
    description: "Change project priority, pause/resume"
  },
  // Admin
  {
    key: "admin.structure",
    description: "Access Admin dashboard and structural views"
  },
  {
    key: "admin.roles_permissions",
    description: "Manage roles and permissions"
  },
  {
    key: "admin.thresholds",
    description: "Manage thresholds and escalation settings"
  },
  {
    key: "admin.sessions",
    description: "View and revoke sessions"
  },
  {
    key: "admin.audit",
    description: "View audit logs and alerts"
  },
  {
    key: "admin.overrides",
    description: "Perform override actions (with logging)"
  }
];

