import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Prepare the dedicated test database: apply migrations (non-destructive) and
 * empty every table. Refuses to run against anything that isn't a *_test DB.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://padel:padel@localhost:5432/padel_test";
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to reset non-test database "${dbName}"`);

  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });

  const db = new PrismaClient({ datasources: { db: { url } } });
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await db.$disconnect();
}
