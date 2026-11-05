import { z } from "zod";

/**
 * Client-safe environment. ONLY `NEXT_PUBLIC_*` variables belong here — they are inlined into the
 * browser bundle by Next, so they must be referenced literally (`process.env.NEXT_PUBLIC_X`).
 * Secrets must never be added to this file; they go in `env-schema.ts` / `env.ts`.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url("must be a valid URL"),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
