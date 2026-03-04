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

const USERS = [
  { email: "admin@cresdynamics.com", name: "Admin", roleKey: ROLE_KEYS.admin },
  { email: "director@cresdynamics.com", name: "Director", roleKey: ROLE_KEYS.director },
  { email: "wilson.developer@cresdynamics.com", name: "Wilson Developer", roleKey: ROLE_KEYS.developer },
  { email: "finance@cresdynamics.com", name: "Finance", roleKey: ROLE_KEYS.finance },
  { email: "salim.sales@cresdynamics.com", name: "Salim Sales", roleKey: ROLE_KEYS.sales }
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  let org = await prisma.org.findFirst({ where: { slug: "cresdynamics" } });
  if (!org) {
    org = await prisma.org.create({
      data: { name: "CresDynamics", slug: "cresdynamics" }
    });
    console.log("Created org:", org.name);
  }

  const roleKeys = [
    ROLE_KEYS.admin,
    ROLE_KEYS.director,
    ROLE_KEYS.finance,
    ROLE_KEYS.developer,
    ROLE_KEYS.sales,
    ROLE_KEYS.analyst,
    ROLE_KEYS.client
  ];
  const roleNames: Record<string, string> = {
    [ROLE_KEYS.admin]: "Admin",
    [ROLE_KEYS.director]: "Director",
    [ROLE_KEYS.finance]: "Finance",
    [ROLE_KEYS.developer]: "Developer",
    [ROLE_KEYS.sales]: "Sales",
    [ROLE_KEYS.analyst]: "Analyst",
    [ROLE_KEYS.client]: "Client"
  };

  let roles = await prisma.role.findMany({ where: { orgId: org.id } });
  if (roles.length === 0) {
    for (const key of roleKeys) {
      await prisma.role.create({
        data: { orgId: org!.id, name: roleNames[key], key }
      });
    }
    roles = await prisma.role.findMany({ where: { orgId: org.id } });
    console.log("Created roles for org");
  }

  const roleByKey = Object.fromEntries(roles.map((r) => [r.key, r]));

  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log("User exists:", u.email);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
        orgId: org!.id
      }
    });

    const role = roleByKey[u.roleKey];
    if (!role) throw new Error(`Role ${u.roleKey} not found`);

    await prisma.orgMember.create({
      data: { orgId: org!.id, userId: user.id, roleId: role.id }
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id }
    });

    console.log("Created:", u.email, "→", u.roleKey);
  }

  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
