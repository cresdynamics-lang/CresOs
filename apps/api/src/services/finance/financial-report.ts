import type { PrismaClient } from "@prisma/client";

export type ReportPreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_6_months"
  | "this_year"
  | "last_year"
  | "all_time"
  | "custom";

export type ReportPeriod = {
  preset: ReportPreset;
  label: string;
  from: string;
  to: string;
  exclusiveEnd: string;
};

export type FinancialReportData = {
  generatedAt: string;
  currency: string;
  period: ReportPeriod;
  revenue: { inPeriod: number; allTime: number; paymentCount: number };
  expenses: {
    inPeriod: number;
    allTime: number;
    expenseCount: number;
    byCategory: { category: string; amount: number; count: number }[];
  };
  salaries: { inPeriod: number; count: number };
  developerPayments: { inPeriod: number; count: number };
  invoices: {
    outstandingAmount: number;
    openInvoiceRemaining: number;
    overdueCount: number;
    byStatus: { status: string; count: number }[];
  };
  projects: {
    approvedCount: number;
    totalContractValue: number;
    totalReceived: number;
    totalRemaining: number;
  };
  payouts: { pendingAmount: number; paidInPeriod: number; paidAllTime: number };
  cashFlow: {
    revenueInPeriod: number;
    expensesInPeriod: number;
    payoutsInPeriod: number;
    totalOutflowsInPeriod: number;
    netInPeriod: number;
  };
  derived: {
    netCashMovementInPeriod: number;
    netCashMovementAllTime: number;
  };
  pending: {
    approvalQueue: number;
    paymentsPending: number;
    total: number;
  };
  /** Snapshot counts for the selected period. */
  activity: {
    paymentsConfirmed: number;
    expensesRecorded: number;
    payoutsPaid: number;
  };
};

const PRESET_LABELS: Record<Exclude<ReportPreset, "custom">, string> = {
  this_week: "This week (Mon–today)",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  last_6_months: "Last 6 months",
  this_year: "This year",
  last_year: "Last year",
  all_time: "All time"
};

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
}

function startOfIsoWeekUtc(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return utcDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff);
}

function parseDateOnly(raw: string | undefined): Date | null {
  const t = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = utcDate(
    Number(t.slice(0, 4)),
    Number(t.slice(5, 7)) - 1,
    Number(t.slice(8, 10))
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveReportPeriod(
  presetRaw: string | undefined,
  fromStr?: string,
  toStr?: string,
  now = new Date()
): ReportPeriod | { error: string } {
  const preset = (presetRaw?.trim() || "this_month") as ReportPreset;

  if (preset === "custom") {
    const from = parseDateOnly(fromStr);
    const to = parseDateOnly(toStr);
    if (!from || !to) return { error: "Custom range requires from and to (YYYY-MM-DD)" };
    if (from.getTime() > to.getTime()) return { error: "from must be on or before to" };
    const exclusiveEnd = utcDate(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1);
    const label = `${fromStr} – ${toStr}`;
    return {
      preset: "custom",
      label,
      from: from.toISOString(),
      to: to.toISOString(),
      exclusiveEnd: exclusiveEnd.toISOString()
    };
  }

  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  let from: Date;
  let to: Date = now;
  let exclusiveEnd: Date;
  let label: string;

  switch (preset) {
    case "this_week": {
      from = startOfIsoWeekUtc(now);
      exclusiveEnd = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      label = PRESET_LABELS.this_week;
      break;
    }
    case "last_week": {
      const thisWeekStart = startOfIsoWeekUtc(now);
      from = utcDate(thisWeekStart.getUTCFullYear(), thisWeekStart.getUTCMonth(), thisWeekStart.getUTCDate() - 7);
      exclusiveEnd = thisWeekStart;
      to = utcDate(exclusiveEnd.getUTCFullYear(), exclusiveEnd.getUTCMonth(), exclusiveEnd.getUTCDate() - 1);
      label = PRESET_LABELS.last_week;
      break;
    }
    case "this_month": {
      from = utcDate(y, m, 1);
      exclusiveEnd = utcDate(y, m + 1, 1);
      label = PRESET_LABELS.this_month;
      break;
    }
    case "last_month": {
      from = utcDate(y, m - 1, 1);
      exclusiveEnd = utcDate(y, m, 1);
      to = utcDate(y, m, 0);
      label = PRESET_LABELS.last_month;
      break;
    }
    case "last_6_months": {
      from = utcDate(y, m - 5, 1);
      exclusiveEnd = utcDate(y, m + 1, 1);
      label = PRESET_LABELS.last_6_months;
      break;
    }
    case "this_year": {
      from = utcDate(y, 0, 1);
      exclusiveEnd = utcDate(y + 1, 0, 1);
      label = PRESET_LABELS.this_year;
      break;
    }
    case "last_year": {
      from = utcDate(y - 1, 0, 1);
      exclusiveEnd = utcDate(y, 0, 1);
      to = utcDate(y - 1, 11, 31);
      label = PRESET_LABELS.last_year;
      break;
    }
    case "all_time": {
      from = utcDate(2000, 0, 1);
      exclusiveEnd = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      label = PRESET_LABELS.all_time;
      break;
    }
    default:
      return { error: `Unknown period preset: ${presetRaw}` };
  }

  return {
    preset,
    label,
    from: from.toISOString(),
    to: (to ?? now).toISOString(),
    exclusiveEnd: exclusiveEnd.toISOString()
  };
}

export async function buildFinancialReport(
  prisma: PrismaClient,
  orgId: string,
  period: ReportPeriod
): Promise<FinancialReportData> {
  const now = new Date();
  const from = new Date(period.from);
  const exclusiveEnd = new Date(period.exclusiveEnd);

  const periodPaymentWhere = {
    orgId,
    deletedAt: null,
    status: "confirmed" as const,
    receivedAt: { gte: from, lt: exclusiveEnd }
  };
  const approvedExpenseStatuses = ["approved", "paid"] as string[];
  const periodExpenseWhere = {
    orgId,
    deletedAt: null,
    status: { in: approvedExpenseStatuses },
    spentAt: { gte: from, lt: exclusiveEnd }
  };
  const periodPayoutWhere = {
    orgId,
    deletedAt: null,
    paidAt: { gte: from, lt: exclusiveEnd }
  };

  const [
    revenueInPeriod,
    revenueAllTime,
    paymentCountInPeriod,
    expensesInPeriod,
    expensesAllTime,
    expenseCountInPeriod,
    expensesByCategory,
    salariesAgg,
    salariesCount,
    devPayAgg,
    devPayCount,
    pendingPayoutsSum,
    payoutsPaidInPeriod,
    payoutsPaidAllTime,
    invoiceCountByStatus,
    approvedProjects,
    openInvoicesForAr,
    pendingApprovalQueue,
    pendingPaymentsCount
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: periodPaymentWhere }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { orgId, deletedAt: null, status: "confirmed" }
    }),
    prisma.payment.count({ where: periodPaymentWhere }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: periodExpenseWhere }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { orgId, deletedAt: null, status: { in: approvedExpenseStatuses } }
    }),
    prisma.expense.count({ where: periodExpenseWhere }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      _count: { id: true },
      where: periodExpenseWhere
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { ...periodExpenseWhere, category: "salaries" }
    }),
    prisma.expense.count({ where: { ...periodExpenseWhere, category: "salaries" } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { ...periodExpenseWhere, category: "developer_payment" }
    }),
    prisma.expense.count({ where: { ...periodExpenseWhere, category: "developer_payment" } }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { orgId, deletedAt: null, paidAt: null }
    }),
    prisma.payout.aggregate({ _sum: { amount: true }, where: periodPayoutWhere }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { orgId, deletedAt: null, paidAt: { not: null } }
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { orgId, deletedAt: null }
    }),
    prisma.project.findMany({
      where: { orgId, deletedAt: null, approvalStatus: "approved" },
      select: { price: true, amountReceived: true }
    }),
    prisma.invoice.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["sent", "partial", "overdue"] }
      },
      select: {
        totalAmount: true,
        payments: {
          where: { deletedAt: null, status: "confirmed" },
          select: { amount: true }
        }
      }
    }),
    prisma.approval.count({
      where: { orgId, status: "pending", entityType: { in: ["expense", "payout"] } }
    }),
    prisma.payment.count({ where: { orgId, deletedAt: null, status: "pending" } })
  ]);

  const revPeriod = revenueInPeriod._sum.amount?.toNumber() ?? 0;
  const revAll = revenueAllTime._sum.amount?.toNumber() ?? 0;
  const expPeriod = expensesInPeriod._sum?.amount?.toNumber() ?? 0;
  const expAll = expensesAllTime._sum.amount?.toNumber() ?? 0;
  const pendingPayouts = pendingPayoutsSum._sum.amount?.toNumber() ?? 0;
  const payoutPaidPeriod = payoutsPaidInPeriod._sum.amount?.toNumber() ?? 0;
  const payoutPaidAll = payoutsPaidAllTime._sum.amount?.toNumber() ?? 0;
  const totalOutPeriod = expPeriod + payoutPaidPeriod;
  const totalOutAll = expAll + payoutPaidAll;

  let projectsTotalContract = 0;
  let projectsTotalReceived = 0;
  let projectsRemaining = 0;
  for (const p of approvedProjects) {
    if (p.price != null) {
      const price = Number(p.price);
      const rec = p.amountReceived != null ? Number(p.amountReceived) : 0;
      projectsTotalContract += price;
      projectsTotalReceived += rec;
      projectsRemaining += Math.max(0, price - rec);
    } else if (p.amountReceived != null) {
      projectsTotalReceived += Number(p.amountReceived);
    }
  }

  let openInvoiceRemaining = 0;
  for (const inv of openInvoicesForAr) {
    const total = Number(inv.totalAmount);
    const paid = inv.payments.reduce((s, pay) => s + Number(pay.amount), 0);
    openInvoiceRemaining += Math.max(0, total - paid);
  }

  const outstandingAmount = projectsRemaining > 0 ? projectsRemaining : openInvoiceRemaining;
  const pendingTotal = pendingApprovalQueue + pendingPaymentsCount;

  const byCategory = expensesByCategory
    .map((g) => ({
      category: g.category,
      amount: g._sum?.amount?.toNumber() ?? 0,
      count: typeof g._count === "object" && g._count != null && "id" in g._count ? g._count.id : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    generatedAt: now.toISOString(),
    currency: "KES",
    period,
    revenue: { inPeriod: revPeriod, allTime: revAll, paymentCount: paymentCountInPeriod },
    expenses: {
      inPeriod: expPeriod,
      allTime: expAll,
      expenseCount: expenseCountInPeriod,
      byCategory
    },
    salaries: {
      inPeriod: salariesAgg._sum?.amount?.toNumber() ?? 0,
      count: salariesCount
    },
    developerPayments: {
      inPeriod: devPayAgg._sum?.amount?.toNumber() ?? 0,
      count: devPayCount
    },
    invoices: {
      outstandingAmount,
      openInvoiceRemaining,
      overdueCount: invoiceCountByStatus.find((g) => g.status === "overdue")?._count.id ?? 0,
      byStatus: invoiceCountByStatus.map((g) => ({ status: g.status, count: g._count.id }))
    },
    projects: {
      approvedCount: approvedProjects.length,
      totalContractValue: projectsTotalContract,
      totalReceived: projectsTotalReceived,
      totalRemaining: projectsRemaining
    },
    payouts: {
      pendingAmount: pendingPayouts,
      paidInPeriod: payoutPaidPeriod,
      paidAllTime: payoutPaidAll
    },
    cashFlow: {
      revenueInPeriod: revPeriod,
      expensesInPeriod: expPeriod,
      payoutsInPeriod: payoutPaidPeriod,
      totalOutflowsInPeriod: totalOutPeriod,
      netInPeriod: revPeriod - totalOutPeriod
    },
    derived: {
      netCashMovementInPeriod: revPeriod - totalOutPeriod,
      netCashMovementAllTime: revAll - totalOutAll
    },
    pending: {
      approvalQueue: pendingApprovalQueue,
      paymentsPending: pendingPaymentsCount,
      total: pendingTotal
    },
    activity: {
      paymentsConfirmed: paymentCountInPeriod,
      expensesRecorded: expenseCountInPeriod,
      payoutsPaid: await prisma.payout.count({ where: periodPayoutWhere })
    }
  };
}

export function financialReportToLegacyShape(data: FinancialReportData) {
  return {
    generatedAt: data.generatedAt,
    period: {
      startOfMonth: data.period.from,
      endOfMonth: data.period.to,
      monthEndExclusive: data.period.exclusiveEnd,
      preset: data.period.preset,
      label: data.period.label
    },
    revenue: { thisMonth: data.revenue.inPeriod, allTime: data.revenue.allTime },
    invoices: data.invoices,
    projects: data.projects,
    expenses: { thisMonth: data.expenses.inPeriod, allTime: data.expenses.allTime },
    payouts: {
      pendingAmount: data.payouts.pendingAmount,
      paidThisMonth: data.payouts.paidInPeriod,
      paidAllTime: data.payouts.paidAllTime
    },
    cashFlow: {
      revenueThisMonth: data.cashFlow.revenueInPeriod,
      expensesThisMonth: data.cashFlow.expensesInPeriod,
      payoutsThisMonth: data.cashFlow.payoutsInPeriod,
      totalOutflowsThisMonth: data.cashFlow.totalOutflowsInPeriod,
      netThisMonth: data.cashFlow.netInPeriod
    },
    derived: {
      netCashMovementThisMonth: data.derived.netCashMovementInPeriod,
      netCashMovementAllTime: data.derived.netCashMovementAllTime
    },
    pending: data.pending,
    salaries: data.salaries,
    developerPayments: data.developerPayments,
    expensesByCategory: data.expenses.byCategory
  };
}

export function financialReportToCsv(data: FinancialReportData): string {
  const rows: string[][] = [
    ["Financial Report", data.period.label],
    ["Generated", data.generatedAt],
    ["Period from", data.period.from],
    ["Period to", data.period.to],
    [],
    ["Section", "Metric", "Value"],
    ["Revenue", "Client payments (in period)", String(data.revenue.inPeriod)],
    ["Revenue", "Client payments (all time)", String(data.revenue.allTime)],
    ["Revenue", "Payment count (in period)", String(data.revenue.paymentCount)],
    ["Expenses", "Total out (in period)", String(data.expenses.inPeriod)],
    ["Expenses", "Total out (all time)", String(data.expenses.allTime)],
    ["Expenses", "Expense count (in period)", String(data.expenses.expenseCount)],
    ["HR", "Salaries & payroll (in period)", String(data.salaries.inPeriod)],
    ["HR", "Salary expense count", String(data.salaries.count)],
    ["Projects", "Developer payments (in period)", String(data.developerPayments.inPeriod)],
    ["Projects", "Developer payment count", String(data.developerPayments.count)],
    ["Payouts", "Pending payouts", String(data.payouts.pendingAmount)],
    ["Payouts", "Paid in period", String(data.payouts.paidInPeriod)],
    ["Cash flow", "Net in period", String(data.cashFlow.netInPeriod)],
    ["Cash flow", "Net all time", String(data.derived.netCashMovementAllTime)],
    ["AR", "Outstanding / remaining", String(data.invoices.outstandingAmount)],
    ["AR", "Open invoice balance", String(data.invoices.openInvoiceRemaining)],
    ["AR", "Overdue invoices", String(data.invoices.overdueCount)],
    ["Projects", "Approved count", String(data.projects.approvedCount)],
    ["Projects", "Contract value", String(data.projects.totalContractValue)],
    ["Projects", "Collected", String(data.projects.totalReceived)],
    ["Pending", "Approval queue", String(data.pending.approvalQueue)],
    ["Pending", "Payments pending", String(data.pending.paymentsPending)]
  ];

  for (const cat of data.expenses.byCategory) {
    rows.push(["Expense category", cat.category.replace(/_/g, " "), String(cat.amount)]);
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    )
    .join("\n");
}

export function reportDownloadFilename(data: FinancialReportData, ext: "pdf" | "csv"): string {
  const slug = data.period.preset === "custom" ? "custom" : data.period.preset;
  const date = data.generatedAt.slice(0, 10);
  return `cresos-finance-report-${slug}-${date}.${ext}`;
}
