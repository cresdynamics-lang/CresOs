import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";

export default function clientRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  async function getClientForUser(orgId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    if (!user?.email) return null;

    return prisma.client.findFirst({
      where: {
        orgId,
        email: user.email,
        deletedAt: null
      }
    });
  }

  async function enrichProjects(orgId: string, projects: { id: string; [key: string]: unknown }[]) {
    return Promise.all(
      projects.map(async (project) => {
        const [taskCount, doneTasks, milestones] = await Promise.all([
          prisma.task.count({
            where: { projectId: project.id, orgId, deletedAt: null }
          }),
          prisma.task.count({
            where: { projectId: project.id, orgId, deletedAt: null, status: "done" }
          }),
          prisma.milestone.findMany({
            where: { projectId: project.id, orgId, deletedAt: null },
            orderBy: { dueDate: "asc" },
            select: {
              id: true,
              name: true,
              status: true,
              dueDate: true
            }
          })
        ]);
        const status = String((project as { status?: string }).status ?? "");
        const progressPercent =
          taskCount > 0 ? Math.round((doneTasks / taskCount) * 100) : status === "completed" ? 100 : 0;
        return {
          ...project,
          taskCount,
          doneTasks,
          progressPercent,
          milestones
        };
      })
    );
  }

  // Admin / director — all portal clients, projects, and login activity
  router.get(
    "/admin/overview",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director]),
    async (req, res) => {
      const orgId = req.auth!.orgId;

      const clients = await prisma.client.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          updatedAt: true
        }
      });

      const clientEmails = clients.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[];
      const portalUsers = clientEmails.length
        ? await prisma.user.findMany({
            where: {
              deletedAt: null,
              email: { in: clientEmails, mode: "insensitive" },
              roles: { some: { role: { orgId, key: ROLE_KEYS.client } } }
            },
            select: { id: true, email: true, name: true }
          })
        : [];

      const userByEmail = new Map(portalUsers.map((u) => [u.email.toLowerCase(), u]));
      const userIds = portalUsers.map((u) => u.id);

      const sessions =
        userIds.length > 0
          ? await prisma.session.findMany({
              where: { orgId, userId: { in: userIds }, revokedAt: null },
              orderBy: { lastSeenAt: "desc" },
              select: {
                userId: true,
                createdAt: true,
                lastSeenAt: true,
                ip: true,
                userAgent: true
              }
            })
          : [];

      const latestSessionByUser = new Map<string, (typeof sessions)[number]>();
      for (const s of sessions) {
        if (!latestSessionByUser.has(s.userId)) latestSessionByUser.set(s.userId, s);
      }

      const portalEvents = await prisma.adminActivityMessage.findMany({
        where: {
          orgId,
          OR: [{ type: "client.portal.login" }, { type: { contains: "client.portal" } }]
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: { select: { id: true, name: true, email: true } }
        }
      });

      const enrichedClients = await Promise.all(
        clients.map(async (client) => {
          const projects = await prisma.project.findMany({
            where: { orgId, clientId: client.id, deletedAt: null },
            orderBy: { createdAt: "desc" }
          });
          const enrichedProjects = await enrichProjects(orgId, projects);
          const emailKey = client.email?.toLowerCase() ?? "";
          const portalUser = emailKey ? userByEmail.get(emailKey) : undefined;
          const session = portalUser ? latestSessionByUser.get(portalUser.id) : undefined;

          return {
            ...client,
            portalUser: portalUser
              ? {
                  id: portalUser.id,
                  name: portalUser.name,
                  email: portalUser.email,
                  lastLoginAt: session?.lastSeenAt?.toISOString() ?? null
                }
              : null,
            hasPortalAccess: Boolean(portalUser),
            lastSession: session
              ? {
                  startedAt: session.createdAt.toISOString(),
                  lastSeenAt: session.lastSeenAt.toISOString(),
                  ip: session.ip,
                  userAgent: session.userAgent
                }
              : null,
            projectCount: enrichedProjects.length,
            projects: enrichedProjects
          };
        })
      );

      const stats = {
        totalClients: enrichedClients.length,
        withPortalLogin: enrichedClients.filter((c) => c.hasPortalAccess).length,
        activeSessions: enrichedClients.filter((c) => c.lastSession).length,
        totalProjects: enrichedClients.reduce((n, c) => n + c.projectCount, 0)
      };

      res.json({
        stats,
        clients: enrichedClients,
        recentActivity: portalEvents.map((e) => ({
          id: e.id,
          type: e.type,
          summary: e.summary,
          body: e.body,
          createdAt: e.createdAt.toISOString(),
          actor: e.actor
        }))
      });
    }
  );

  router.get("/projects", requireRoles([ROLE_KEYS.client]), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;

    const client = await getClientForUser(orgId, userId);
    if (!client) {
      res.status(404).json({ error: "Client mapping not found" });
      return;
    }

    const projects = await prisma.project.findMany({
      where: { orgId, clientId: client.id, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    res.json(await enrichProjects(orgId, projects));
  });

  router.get("/projects/:projectId/milestones", requireRoles([ROLE_KEYS.client]), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;

    const client = await getClientForUser(orgId, userId);
    if (!client) {
      res.status(404).json({ error: "Client mapping not found" });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, clientId: client.id, deletedAt: null }
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const milestones = await prisma.milestone.findMany({
      where: { orgId, projectId, deletedAt: null },
      orderBy: { dueDate: "asc" }
    });

    res.json(milestones);
  });

  router.get("/invoices", requireRoles([ROLE_KEYS.client]), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;

    const client = await getClientForUser(orgId, userId);
    if (!client) {
      res.status(404).json({ error: "Client mapping not found" });
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: { orgId, clientId: client.id, deletedAt: null },
      orderBy: { issueDate: "desc" }
    });

    res.json(invoices);
  });

  router.get("/payments", requireRoles([ROLE_KEYS.client]), async (req, res) => {
    const orgId = req.auth!.orgId;
    const userId = req.auth!.userId;

    const client = await getClientForUser(orgId, userId);
    if (!client) {
      res.status(404).json({ error: "Client mapping not found" });
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: { orgId, clientId: client.id, deletedAt: null },
      select: { id: true }
    });
    const invoiceIds = invoices.map((i) => i.id);

    const payments = await prisma.payment.findMany({
      where: { orgId, invoiceId: { in: invoiceIds }, deletedAt: null },
      orderBy: { receivedAt: "desc" }
    });

    res.json(payments);
  });

  return router;
}
