/**
 * Runs once when a Next.js server instance starts (see node_modules/next/dist/docs, file convention
 * `instrumentation`). Importing `lib/env` here validates the environment at boot (fail fast).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
  }
}
