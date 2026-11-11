/**
 * Seed demo data only if the database has no products yet.
 * Used by the Vercel build when DEMO_AUTO_SEED=true, so a fresh deploy is
 * immediately testable but existing data is never wiped.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
db.product
  .count()
  .then(async (n) => {
    await db.$disconnect();
    if (n > 0) {
      console.log(`Database already has ${n} products — skipping demo seed.`);
      return;
    }
    console.log("Empty database — seeding demo data…");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, SEED_FORCE: "true" } });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
