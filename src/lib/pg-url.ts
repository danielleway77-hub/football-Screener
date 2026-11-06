/** `sslmode=require` already means verify-full in node-postgres; say so explicitly (silences its warning). */
export function normalizeSsl(url: string): string {
  return url.replace(/([?&])sslmode=(require|prefer|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
}

/** Returns the `schema` query parameter (Prisma convention), or "public". */
export function schemaOf(url: string): string {
  return new URL(url).searchParams.get("schema") ?? "public";
}

/** Strips Prisma-only parameters that node-postgres does not understand. */
export function stripPrismaParams(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("schema");
  u.searchParams.delete("channel_binding");
  return normalizeSsl(u.toString());
}
