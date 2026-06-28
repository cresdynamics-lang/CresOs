import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { allocateInvoiceNumberForCreate } from "../services/invoice/invoice-number";
import { deliverSalesInvoiceEmail } from "../lib/invoice-email";
import { logEmailSent } from "./admin-activity";

/** Avoid Invalid Date from empty due-date strings (same as finance). */
function parseInvoiceDueDate(raw: string | undefined | null): Date | null {
  if (raw == null || String(raw).trim() === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

type SalesInvoicePayload = Prisma.InvoiceGetPayload<{
  include: {
    client: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
    items: true;
  };
}>;

type SalesInvoiceSummaryPayload = Prisma.InvoiceGetPayload<{
  include: {
    client: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
  };
}>;

function whereSalesInvoices(
  orgId: string,
  userId: string,
  isAdmin: boolean
): Prisma.InvoiceWhereInput {
  if (isAdmin) {
    return { orgId, deletedAt: null };
  }
  return {
    orgId,
    deletedAt: null,
    project: {
      OR: [{ createdByUserId: userId }, { ownerUserId: userId }]
    }
  };
}

function serializeInvoiceRow(
  inv:
    | SalesInvoicePayload
    | (SalesInvoiceSummaryPayload & { items?: SalesInvoicePayload["items"] })
) {
  const items = (inv.items ?? []).map((it) => ({
    id: it.id,
    description: it.description,
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
    total: it.quantity * Number(it.unitPrice)
  }));
  return {
    id: inv.id,
    number: inv.number,
    invoiceNumber: inv.number,
    status: inv.status,
    currency: inv.currency,
    totalAmount: Number(inv.totalAmount),
    subtotal: Number(inv.totalAmount),
    taxAmount: 0,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    notes: inv.notes,
    createdAt: inv.createdAt.toISOString(),
    client: inv.client,
    project: inv.project,
    items
  };
}

export default function salesRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  router.get(
    "/dashboard",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);
        const base = whereSalesInvoices(orgId, userId, isAdmin);

        const outstandingWhere: Prisma.InvoiceWhereInput = {
          ...base,
          status: { in: ["draft", "sent", "partial", "overdue"] }
        };

        const [
          totalInvoices,
          outstandingInvoices,
          paidInvoices,
          cancelledInvoices,
          overdueInvoices,
          recentRaw,
          deals,
          projects,
          leadsThisWeek,
          leadsPendingApproval
        ] = await Promise.all([
          prisma.invoice.count({ where: base }),
          prisma.invoice.count({ where: outstandingWhere }),
          prisma.invoice.count({
            where: { ...base, status: "paid" }
          }),
          prisma.invoice.count({
            where: { ...base, status: "cancelled" }
          }),
          prisma.invoice.count({
            where: { ...base, status: "overdue" }
          }),
          prisma.invoice.findMany({
            where: base,
            include: {
              client: { select: { id: true, name: true, email: true } },
              project: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 10
          }),
          prisma.deal.findMany({
            where: { orgId, deletedAt: null, ...(isAdmin ? {} : { ownerId: userId }) },
            select: { stage: true }
          }),
          prisma.project.findMany({
            where: { orgId, deletedAt: null },
            select: { status: true }
          }),
          (() => {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            return prisma.lead.count({
              where: {
                orgId,
                deletedAt: null,
                createdAt: { gte: startOfWeek },
                ...(isAdmin ? {} : { ownerId: userId })
              }
            });
          })(),
          prisma.lead.count({
            where: {
              orgId,
              deletedAt: null,
              approvalStatus: "pending_approval",
              ...(isAdmin ? {} : { ownerId: userId })
            }
          })
        ]);

        const invoiceStatusGroups = await prisma.invoice.groupBy({
          by: ["status"],
          where: base,
          _count: { _all: true }
        });

        const dealsByStage = deals.reduce<Record<string, number>>((acc, d) => {
          const s = d.stage || "prospect";
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});

        const projectsByStatus = projects.reduce<Record<string, number>>((acc, p) => {
          const s = p.status || "planned";
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});

        const wonDeals = deals.filter((d) => d.stage === "won").length;
        const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage)).length;

        const recentInvoices = recentRaw.map((inv) => serializeInvoiceRow({ ...inv, items: [] }));

        res.json({
          success: true,
          data: {
            stats: {
              total: totalInvoices,
              outstanding: outstandingInvoices,
              paid: paidInvoices,
              cancelled: cancelledInvoices,
              overdue: overdueInvoices,
              /** @deprecated use outstanding — kept for older clients */
              pending: outstandingInvoices,
              approved: paidInvoices,
              rejected: cancelledInvoices
            },
            kpis: {
              leadsThisWeek,
              activeDeals,
              wonDeals,
              activeProjects: projects.filter((p) => ["planned", "active"].includes(p.status)).length
            },
            charts: {
              invoicesByStatus: invoiceStatusGroups.map((g) => ({
                label: g.status,
                value: g._count._all
              })),
              dealsByStage: Object.entries(dealsByStage).map(([label, value]) => ({ label, value })),
              projectsByStatus: Object.entries(projectsByStatus).map(([label, value]) => ({ label, value }))
            },
            alerts: {
              outstandingInvoices,
              overdueInvoices,
              leadsPendingApproval,
              dealsInProspect: dealsByStage.prospect ?? 0
            },
            recentInvoices
          }
        });
      } catch (error) {
        console.error("Error fetching sales dashboard:", error);
        res.status(500).json({
          error: "Failed to fetch sales dashboard",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.post(
    "/invoices",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      const orgId = req.auth!.orgId;
      const userId = req.auth!.userId;
      const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);

      const {
        clientId,
        projectId,
        issueDate,
        dueDate,
        currency,
        items,
        notes
      } = req.body as {
        clientId?: string;
        projectId?: string | null;
        issueDate?: string;
        dueDate?: string | null;
        currency?: string;
        notes?: string | null;
        items?: Array<{ description: string; quantity: number; unitPrice: string | number }>;
      };

      if (!isAdmin && !projectId) {
        res.status(400).json({
          error: "Project required",
          message: "Select a project so invoice totals stay linked for finance and payments."
        });
        return;
      }

      const issueDateStr = issueDate?.trim() || new Date().toISOString().slice(0, 10);

      const normalizedItems = (items ?? [])
        .map((it) => ({
          description: String(it.description ?? "").trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitPrice: String(it.unitPrice ?? "").trim()
        }))
        .filter((it) => it.description && it.unitPrice && !Number.isNaN(Number(it.unitPrice)));

      if (!clientId || normalizedItems.length === 0) {
        res.status(400).json({ error: "Missing fields", message: "Client and line items are required." });
        return;
      }

      if (!isAdmin && projectId) {
        const allowed = await prisma.project.findFirst({
          where: {
            id: projectId,
            orgId,
            deletedAt: null,
            OR: [{ createdByUserId: userId }, { ownerUserId: userId }]
          },
          select: { id: true }
        });
        if (!allowed) {
          res.status(403).json({
            error: "Forbidden",
            message: "You can only create invoices for projects you own or created."
          });
          return;
        }
      }

      try {
        const client = await prisma.client.findFirst({
          where: { id: clientId, orgId, deletedAt: null },
          select: { id: true, name: true, email: true }
        });
        if (!client) {
          res.status(404).json({ error: "Client not found" });
          return;
        }

        const issue = new Date(issueDateStr);
        if (Number.isNaN(issue.getTime())) {
          res.status(400).json({ error: "Invalid issue date" });
          return;
        }

        const clientEmail = client.email?.trim() || "";

        const result = await prisma.$transaction(
          async (tx) => {
            const totalAmount = normalizedItems.reduce((sum, item) => {
              const value = Number(item.unitPrice) * item.quantity;
              return sum + value;
            }, 0);

            if (projectId) {
              const project = await tx.project.findFirst({
                where: { id: projectId, orgId, deletedAt: null },
                select: { id: true, clientId: true }
              });
              if (!project) {
                throw Object.assign(new Error("Project not found"), { code: "PROJECT_NOT_FOUND" });
              }
              if (project.clientId && project.clientId !== clientId) {
                throw Object.assign(new Error("Client must match project"), {
                  code: "CLIENT_PROJECT_MISMATCH"
                });
              }
            }

            const number = await allocateInvoiceNumberForCreate(tx, orgId, projectId, issue);

            const invoice = await tx.invoice.create({
              data: {
                orgId,
                clientId,
                projectId: projectId || null,
                number,
                status: "sent",
                issueDate: issue,
                dueDate: parseInvoiceDueDate(dueDate),
                currency: currency ?? "KES",
                totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
                notes: notes?.trim() ? notes.trim() : null
              }
            });

            await tx.invoiceItem.createMany({
              data: normalizedItems.map((item) => ({
                invoiceId: invoice.id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice)
              }))
            });

            await tx.eventLog.create({
              data: {
                orgId,
                type: "invoice.sent",
                entityType: "invoice",
                entityId: invoice.id,
                metadata: { number: invoice.number, clientId: invoice.clientId, source: "sales" }
              }
            });

            return invoice;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000
          }
        );

        if (clientEmail) {
          try {
            const emailResult = await deliverSalesInvoiceEmail(prisma, {
              orgId,
              invoiceId: result.id,
              to: clientEmail,
              clientName: client.name
            });
            if (emailResult.ok) {
              await logEmailSent(prisma, {
                orgId,
                to: clientEmail,
                subject: `Your invoice ${result.number} — Cres Dynamics`,
                body: `Sales invoice ${result.number} sent with PDF to ${clientEmail}.`,
                type: "invoice.sent.sales"
              });
            } else {
              console.error("Sales invoice email failed:", emailResult.error);
            }
          } catch (logErr) {
            console.error("deliverSalesInvoiceEmail after sales invoice create:", logErr);
          }
        }

        const financeUsers = await prisma.user.findMany({
          where: {
            roles: {
              some: {
                role: { orgId, key: { in: [ROLE_KEYS.finance, ROLE_KEYS.admin] } }
              }
            }
          },
          select: { id: true }
        });

        if (financeUsers.length > 0) {
          await prisma.notification.createMany({
            data: financeUsers.map((u) => ({
              orgId,
              channel: "in_app",
              to: u.id,
              subject: "New invoice",
              body: `Invoice ${result.number} was issued. Link incoming payments to this invoice in Finance; confirmed payments update project receipts automatically when the invoice has a project.`,
              status: "sent",
              type: "invoice.created",
              tier: "financial"
            }))
          });
        }

        const full = await prisma.invoice.findUnique({
          where: { id: result.id },
          include: {
            client: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
            items: true
          }
        });

        res.status(201).json({
          success: true,
          message:
            "Invoice created and recorded. Finance can record payments against this invoice; confirming a payment updates project amount received when the invoice is linked to a project.",
          data: full ? serializeInvoiceRow(full) : null
        });
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err?.code === "PROJECT_NOT_FOUND" || err?.message === "Project not found") {
          res.status(400).json({ error: "Project not found" });
          return;
        }
        if (err?.code === "CLIENT_PROJECT_MISMATCH") {
          res.status(400).json({
            error: "Client mismatch",
            message: "Selected client must match the project's client."
          });
          return;
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          res.status(409).json({
            error: "Duplicate invoice number",
            message: "Try again in a moment or contact support."
          });
          return;
        }
        console.error("POST /sales/invoices:", e);
        res.status(500).json({
          error: "Failed to create invoice",
          message: e instanceof Error ? e.message : "Unknown error"
        });
      }
    }
  );

  router.get(
    "/invoices",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);
        const { status, page = "1", limit = "20" } = req.query;

        const base = whereSalesInvoices(orgId, userId, isAdmin);
        const where: Prisma.InvoiceWhereInput = { ...base };

        if (status && status !== "ALL") {
          const st = Array.isArray(status) ? status[0] : status;
          where.status = String(st);
        }

        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));

        const [rows, total] = await Promise.all([
          prisma.invoice.findMany({
            where,
            include: {
              client: { select: { id: true, name: true, email: true } },
              project: { select: { id: true, name: true } },
              items: true
            },
            orderBy: { createdAt: "desc" },
            skip: (pageNum - 1) * limitNum,
            take: limitNum
          }),
          prisma.invoice.count({ where })
        ]);

        res.json({
          success: true,
          data: {
            invoices: rows.map((inv) => serializeInvoiceRow(inv)),
            pagination: {
              page: pageNum,
              limit: limitNum,
              total,
              pages: Math.ceil(total / limitNum) || 1
            }
          }
        });
      } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({
          error: "Failed to fetch invoices",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.get(
    "/invoices/:id",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;

        const base = whereSalesInvoices(orgId, userId, isAdmin);
        const invoice = await prisma.invoice.findFirst({
          where: { ...base, id },
          include: {
            client: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
            items: true
          }
        });

        if (!invoice) {
          res.status(404).json({ error: "Invoice not found" });
          return;
        }

        res.json({
          success: true,
          data: serializeInvoiceRow(invoice)
        });
      } catch (error) {
        console.error("Error fetching invoice:", error);
        res.status(500).json({
          error: "Failed to fetch invoice",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.get(
    "/clients",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;

        const clients = await prisma.client.findMany({
          where: {
            orgId,
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          },
          orderBy: { name: "asc" }
        });

        res.json({
          success: true,
          data: clients
        });
      } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({
          error: "Failed to fetch clients",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.get(
    "/projects",
    requireRoles([ROLE_KEYS.sales, ROLE_KEYS.admin]),
    async (req, res) => {
      try {
        const orgId = req.auth!.orgId;
        const userId = req.auth!.userId;
        const isAdmin = req.auth!.roleKeys.includes(ROLE_KEYS.admin);

        const projects = await prisma.project.findMany({
          where: {
            orgId,
            deletedAt: null,
            ...(!isAdmin && {
              OR: [{ createdByUserId: userId }, { ownerUserId: userId }]
            })
          },
          select: {
            id: true,
            name: true,
            clientId: true,
            status: true,
            price: true,
            amountReceived: true,
            approvalStatus: true,
            client: {
              select: {
                name: true
              }
            }
          },
          orderBy: { name: "asc" }
        });

        const data = projects.map((p) => ({
          ...p,
          price: p.price != null ? Number(p.price) : null,
          amountReceived: p.amountReceived != null ? Number(p.amountReceived) : null
        }));

        res.json({
          success: true,
          data
        });
      } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({
          error: "Failed to fetch projects",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  return router;
}
