import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./create-app";

const prisma = new PrismaClient();
const app = createApp(prisma);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CresOS API running on http://localhost:${PORT}`);
});
