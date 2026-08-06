/**
 * Local e2e: mock Initialize + submitInvoiceToEtims → etimsStatus mock with resultCd 000.
 * Run: cd apps/api && npx ts-node-dev --transpile-only --respawn false src/scripts/etims-e2e-mock.ts
 * Or:  npx vitest run tests/etims-mock-file.e2e.test.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  initializeEtimsDevice,
  submitInvoiceToEtims
} from "../services/etims/oscu-client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No org in DB — run seed first");

  await prisma.orgEtimsConfig.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      tin: "P052570833B",
      taxpayerName: "CRES SOFTWARE LIMITED",
      bhfId: "00",
      dvcSrlNo: "CRESOSCU001",
      mode: "mock",
      enabled: true,
      autoSubmit: true
    },
    update: { mode: "mock", enabled: true, autoSubmit: true }
  });

  const init = await initializeEtimsDevice(prisma, org.id);
  if (!init.ok) throw new Error(`Initialize failed: ${init.message}`);
  console.log("OK initialize:", init.message);

  let client = await prisma.client.findFirst({
    where: { orgId: org.id, deletedAt: null },
    orderBy: { createdAt: "asc" }
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        orgId: org.id,
        name: "eTIMS E2E Client",
        email: "etims-e2e@example.com",
        kraPin: "A123456789Z"
      }
    });
  } else if (!client.kraPin) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { kraPin: "A123456789Z" }
    });
  }

  const inv = await prisma.invoice.create({
    data: {
      orgId: org.id,
      clientId: client.id,
      number: `E2E-ETIMS-${Date.now().toString().slice(-8)}`,
      status: "sent",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 864e5),
      currency: "KES",
      totalAmount: 1160,
      buyerKraPin: "A123456789Z",
      etimsStatus: "pending",
      items: {
        create: [
          {
            description: "CresOS eTIMS e2e line",
            quantity: 1,
            unitPrice: 1160
          }
        ]
      }
    }
  });

  const result = await submitInvoiceToEtims(prisma, org.id, inv.id, { force: true });
  const fresh = await prisma.invoice.findUnique({
    where: { id: inv.id },
    select: { etimsStatus: true, etimsResultCd: true, etimsInvcNo: true, etimsResultMsg: true }
  });

  console.log("submit result:", result.status, result.resultCd, result.resultMsg);
  console.log("invoice:", fresh);

  const ok =
    fresh &&
    (fresh.etimsStatus === "mock" || fresh.etimsStatus === "submitted") &&
    fresh.etimsResultCd === "000";
  if (!ok) {
    throw new Error(`Expected etimsStatus mock|submitted with resultCd 000, got ${JSON.stringify(fresh)}`);
  }
  console.log("OK e2e filing confirmed etimsStatus=%s", fresh.etimsStatus);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
