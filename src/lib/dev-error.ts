type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Test hook for the error boundaries: in development ONLY, `?__error=1` makes a page throw so the
 * error UI can be exercised. It is a no-op in production builds.
 */
export async function throwIfForced(searchParams: SearchParams): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const params = await searchParams;
  if (params.__error === "1") throw new Error("Forced test error (?__error=1)");
}
