/** Strip financial and ownership fields from project payloads for PM workspace. */
export function sanitizeProjectForPm<T extends Record<string, unknown>>(project: T): Record<string, unknown> {
  const {
    price: _price,
    amountReceived: _amountReceived,
    managementMonthlyAmount: _mma,
    managementMonths: _mm,
    managementActive: _ma,
    managementStartedAt: _msa,
    financeProjectSeq: _fps,
    financeRefYear: _fry,
    nextInvoiceOrdinal: _nio,
    owner: _owner,
    createdBy: _createdBy,
    client: _client,
    email: _email,
    phone: _phone,
    clientOrOwnerName: _con,
    ownerUserId: _oui,
    createdByUserId: _cbi,
    clientId: _ci,
    dealId: _di,
    ...safe
  } = project as Record<string, unknown>;
  return safe;
}

export const PM_PROJECT_LIST_SELECT = {
  id: true,
  orgId: true,
  name: true,
  status: true,
  priority: true,
  type: true,
  startDate: true,
  endDate: true,
  successCriteria: true,
  projectDetails: true,
  agileSprintNotes: true,
  approvalStatus: true,
  approvedAt: true,
  developerReviewedAt: true,
  managementProgressPercent: true,
  projectManagerUserId: true,
  timeline: true,
  createdAt: true,
  updatedAt: true,
  assignedDeveloper: { select: { id: true, name: true } },
  developerAssignments: {
    where: { status: "accepted" },
    include: { user: { select: { id: true, name: true, email: true } } }
  },
  milestones: {
    orderBy: { dueDate: "asc" as const },
    select: {
      id: true,
      name: true,
      dueDate: true,
      status: true,
      acceptanceCriteria: true,
      completionNotes: true
    }
  },
  _count: { select: { tasks: true } }
};
