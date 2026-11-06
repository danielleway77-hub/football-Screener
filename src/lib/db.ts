import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { schemaOf, stripPrismaParams } from "@/lib/pg-url";

/**
 * The ONLY place a PrismaClient is created (plus src/server/repositories/*, the only importers of it).
 * Runtime uses the pooled DATABASE_URL through the node-postgres driver adapter (Prisma 7).
 * The client is cached on `globalThis` so Next hot reload and warm serverless invocations reuse it.
 */
const globalForDb = globalThis as unknown as { __db?: PrismaClient; __dbUrl?: string };

export function createDb(connectionString: string): PrismaClient {
  const schema = schemaOf(connectionString);
  const adapter = new PrismaPg(
    {
      connectionString: stripPrismaParams(connectionString),
      max: 5,
      // Non-default schema (tests): also set the session search_path so raw SQL and Prisma agree.
      // Needs a DIRECT connection: the PgBouncer pooler ignores startup options.
      ...(schema !== "public" ? { options: `-c search_path=${schema}` } : {}),
    },
    { schema },
  );
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Re-create if the URL changed (tests switch to the isolated test schema).
  if (!globalForDb.__db || globalForDb.__dbUrl !== url) {
    void globalForDb.__db?.$disconnect();
    globalForDb.__db = createDb(url);
    globalForDb.__dbUrl = url;
  }
  return globalForDb.__db;
}

export async function disconnectDb(): Promise<void> {
  await globalForDb.__db?.$disconnect();
  globalForDb.__db = undefined;
  globalForDb.__dbUrl = undefined;
}

export type Db = PrismaClient;
