import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { schemaOf, stripPrismaParams } from "@/lib/pg-url";

/**
 * The ONLY place a PrismaClient is created (plus src/server/repositories/*, the only importers of it).
 * Runtime uses the pooled DATABASE_URL through the node-postgres driver adapter (Prisma 7).
 * The client is cached on `globalThis` so Next hot reload and warm serverless invocations reuse it.
 */
const globalForDb = globalThis as unknown as { __db?: PrismaClient; __dbUrl?: string };

/**
 * Pool limits (documented in docs/ARCHITECTURE.md "Database resilience"). Serverless-friendly: a small pool per
 * instance because the Supabase/PgBouncer pooler multiplexes. Times are milliseconds.
 */
export const POOL = {
  max: 5,
  /** Idle clients are closed after 10 s so a warm lambda does not pin pooler slots. */
  idleTimeoutMillis: 10_000,
  /** Fail fast (instead of queueing forever) when no connection can be had. */
  connectionTimeoutMillis: 5_000,
  /** Client-side cap per query; works through any pooler (no startup parameter). */
  query_timeout: 20_000,
  /** Server-side cap, sent as a startup parameter: skipped for pooled URLs (PgBouncer may reject it). */
  statement_timeout: 15_000,
  keepAlive: true,
} as const;

/** True for Supabase/PgBouncer transaction pooler URLs (port 6543 or a "pooler" host). */
export function isPooledUrl(connectionString: string): boolean {
  try {
    const u = new URL(connectionString);
    return (
      u.port === "6543" || /pooler|pgbouncer/i.test(u.hostname) || u.searchParams.has("pgbouncer")
    );
  } catch {
    return false;
  }
}

export function poolConfig(connectionString: string) {
  const { statement_timeout, ...rest } = POOL;
  return { ...rest, ...(isPooledUrl(connectionString) ? {} : { statement_timeout }) };
}

export function createDb(connectionString: string): PrismaClient {
  const schema = schemaOf(connectionString);
  const adapter = new PrismaPg(
    {
      connectionString: stripPrismaParams(connectionString),
      ...poolConfig(connectionString),
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
