/**
 * One-off: rotate a user's password by email.
 * Usage: ROTATE_EMAIL=admin@cresdynamics.com ROTATE_PASSWORD='...' npx ts-node-dev --transpile-only --respawn false src/scripts/rotate-user-password.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ROTATE_EMAIL?.trim().toLowerCase();
  const password = process.env.ROTATE_PASSWORD;
  if (!email || !password) {
    throw new Error("Set ROTATE_EMAIL and ROTATE_PASSWORD env vars");
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true }
  });
  if (!user) throw new Error(`User not found: ${email}`);

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });
  console.log(`OK password rotated for ${user.name} <${user.email}>`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
