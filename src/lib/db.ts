import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Neon/most hosts set DATABASE_URL; the Supabase Vercel integration sets POSTGRES_PRISMA_URL.
    datasourceUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
