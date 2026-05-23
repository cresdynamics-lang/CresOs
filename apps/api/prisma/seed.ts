import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLE_KEYS = {
  admin: "admin",
  director: "director_admin",
  finance: "finance",
  developer: "developer",
  sales: "sales",
  analyst: "analyst",
  client: "client"
} as const;

const PASSWORD = "Cres@Team2026#";
const DIRECTOR_PASSWORD = "Henry@Cres";

const USERS = [
  { email: "admin@cresdynamics.com", name: "Admin", roleKey: ROLE_KEYS.admin, password: PASSWORD },
  { email: "director@cresdynamics.com", name: "Director", roleKey: ROLE_KEYS.director, password: DIRECTOR_PASSWORD },
  { email: "wilson.developer@cresdynamics.com", name: "Wilson Developer", roleKey: ROLE_KEYS.developer, password: PASSWORD },
  { email: "finance@cresdynamics.com", name: "Finance", roleKey: ROLE_KEYS.finance, password: PASSWORD },
  { email: "salim.sales@cresdynamics.com", name: "Salim Sales", roleKey: ROLE_KEYS.sales, password: PASSWORD }
] as const;

const ROLE_NAMES: Record<string, string> = {
  [ROLE_KEYS.admin]: "Admin",
  [ROLE_KEYS.director]: "Director",
  [ROLE_KEYS.finance]: "Finance",
  [ROLE_KEYS.developer]: "Developer",
  [ROLE_KEYS.sales]: "Sales",
  [ROLE_KEYS.analyst]: "Analyst",
  [ROLE_KEYS.client]: "Client"
};

async function ensureOrg() {
  let org = await prisma.org.findFirst({ where: { slug: "cresdynamics" } });
  if (!org) {
    org = await prisma.org.create({
      data: { name: "CresDynamics", slug: "cresdynamics" }
    });
    console.log("Created org:", org.name);
  }
  return org;
}

async function ensureRoles(orgId: string) {
  const roleKeys = Object.values(ROLE_KEYS);
  let roles = await prisma.role.findMany({ where: { orgId } });
  const existingKeys = new Set(roles.map((r) => r.key));
  for (const key of roleKeys) {
    if (!existingKeys.has(key)) {
      await prisma.role.create({
        data: { orgId, name: ROLE_NAMES[key], key }
      });
    }
  }
  roles = await prisma.role.findMany({ where: { orgId } });
  return Object.fromEntries(roles.map((r) => [r.key, r]));
}

async function upsertSeedUser(
  orgId: string,
  roleByKey: Record<string, { id: string; key: string }>,
  spec: (typeof USERS)[number]
) {
  const passwordHash = await bcrypt.hash(spec.password, 10);
  const role = roleByKey[spec.roleKey];
  if (!role) throw new Error(`Role ${spec.roleKey} not found`);

  let user = await prisma.user.findFirst({
    where: { email: { equals: spec.email, mode: "insensitive" }, deletedAt: null }
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: spec.name,
        passwordHash,
        orgId,
        status: "active",
        deletedAt: null,
        profileCompletedAt: user.profileCompletedAt ?? new Date()
      }
    });
    console.log("Updated user:", spec.email);
  } else {
    user = await prisma.user.create({
      data: {
        email: spec.email.toLowerCase(),
        name: spec.name,
        passwordHash,
        orgId,
        status: "active",
        profileCompletedAt: new Date()
      }
    });
    console.log("Created user:", spec.email);
  }

  const membership = await prisma.orgMember.findFirst({
    where: { orgId, userId: user.id }
  });
  if (!membership) {
    await prisma.orgMember.create({
      data: { orgId, userId: user.id, roleId: role.id }
    });
  } else if (membership.roleId !== role.id) {
    await prisma.orgMember.update({
      where: { id: membership.id },
      data: { roleId: role.id }
    });
  }

  const userRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id }
  });
  if (!userRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id }
    });
  }

  return user;
}

async function assignTeamToDirector(orgId: string, directorId: string) {
  const teamEmails = ["wilson.developer@cresdynamics.com", "salim.sales@cresdynamics.com"];
  for (const email of teamEmails) {
    const u = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null }
    });
    if (u) {
      await prisma.user.update({
        where: { id: u.id },
        data: { reportsToDirectorId: directorId }
      });
      console.log("Assigned team:", email, "→ director");
    }
  }
}

async function seedDemoData(orgId: string, directorId: string, developerId: string, salesId: string) {
  const existingProject = await prisma.project.findFirst({
    where: { orgId, name: "Acme Retail Platform" }
  });
  if (existingProject) {
    console.log("Demo project exists:", existingProject.name);
    return;
  }

  const project = await prisma.project.create({
    data: {
      orgId,
      name: "Acme Retail Platform",
      status: "active",
      type: "project",
      clientOrOwnerName: "Acme Retail Ltd",
      phone: "+254700000001",
      email: "contact@acme.example",
      price: 150000,
      approvalStatus: "approved",
      approvedAt: new Date(),
      assignedDeveloperId: developerId,
      createdByUserId: salesId,
      approvedById: directorId,
      financeProjectSeq: 1,
      financeRefYear: new Date().getFullYear()
    }
  });
  console.log("Created demo project:", project.name);

  await prisma.projectDeveloperAssignment.upsert({
    where: { projectId_userId: { projectId: project.id, userId: developerId } },
    create: {
      orgId,
      projectId: project.id,
      userId: developerId,
      status: "accepted",
      invitedById: directorId,
      respondedAt: new Date()
    },
    update: { status: "accepted", respondedAt: new Date() }
  });
  console.log("Wilson accepted on demo project");

  const lead = await prisma.lead.findFirst({ where: { orgId, title: "Acme Retail Platform" } });
  if (!lead) {
    await prisma.lead.create({
      data: {
        orgId,
        title: "Acme Retail Platform",
        status: "qualified",
        source: "project",
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedById: directorId,
        ownerId: salesId,
        projectId: project.id
      }
    });
    console.log("Created demo lead");
  }
}

async function main() {
  const org = await ensureOrg();
  const roleByKey = await ensureRoles(org.id);

  const usersByEmail: Record<string, { id: string }> = {};
  for (const u of USERS) {
    const user = await upsertSeedUser(org.id, roleByKey, u);
    usersByEmail[u.email] = user;
  }

  const director = usersByEmail["director@cresdynamics.com"];
  if (director) {
    await assignTeamToDirector(org.id, director.id);
  }

  const wilson = usersByEmail["wilson.developer@cresdynamics.com"];
  const salim = usersByEmail["salim.sales@cresdynamics.com"];
  if (director && wilson && salim) {
    await seedDemoData(org.id, director.id, wilson.id, salim.id);
  }

  console.log("\n--- Seed credentials ---");
  for (const u of USERS) {
    console.log(`${u.roleKey.padEnd(12)} ${u.email} / ${u.password}`);
  }
  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
