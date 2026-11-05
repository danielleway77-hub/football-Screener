import { z } from "zod";

/**
 * Pure environment validation (no `server-only`, no Next imports) so it can be unit tested.
 * The server-only wrapper lives in `env.ts`; client-safe values live in `env.public.ts`.
 * Error messages NEVER contain values — only variable names and the rule that failed.
 */

const postgresUrl = z
  .string()
  .min(1, "must not be empty")
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// or postgresql:// URL");

/** An origin is scheme + host (+ port) with no path. https everywhere; http only for localhost. */
function isAllowedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.origin !== value) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

const originList = z
  .string()
  .min(1, "must list at least one origin")
  .transform((raw) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.string().refine(isAllowedOrigin, "each entry must be an origin like https://example.com"),
      )
      .min(1, "must list at least one origin"),
  );

const bcryptHash = z
  .string()
  .regex(
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
    "must be a bcrypt hash (run `pnpm hash-password`)",
  );

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: postgresUrl,
    DIRECT_URL: postgresUrl,
    SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
    CRON_SECRET: z.string().min(32, "must be at least 32 characters"),
    /** Optional until Step 6 introduces login; required in production (see superRefine). */
    APP_PASSWORD_HASH: bcryptHash.optional(),
    NEXT_PUBLIC_APP_URL: z.url("must be a valid URL"),
    INGEST_ALLOWED_ORIGINS: originList,
    PROVIDER_API_BASE: z.url("must be a valid URL").optional(),
    PROVIDER_API_KEY: z.string().min(1).optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.APP_PASSWORD_HASH) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_PASSWORD_HASH"],
        message: "is required in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: { name: string; message: string }[];

  constructor(issues: { name: string; message: string }[]) {
    super(
      [
        "Invalid environment variables:",
        ...issues.map((issue) => `  - ${issue.name}: ${issue.message}`),
        "Fix your .env.local (see .env.example). Values are never printed.",
      ].join("\n"),
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

type EnvSource = Record<string, string | undefined>;

export function parseServerEnv(source: EnvSource): ServerEnv {
  // Treat empty strings (e.g. `FOO=` in a dotenv file) as "not set".
  const cleaned: EnvSource = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ""),
  );
  const result = serverEnvSchema.safeParse(cleaned);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? "environment");
    // Only a genuinely missing required value gets the generic wording; custom rules (for example
    // "is required in production") keep their own, more specific message.
    const missing = cleaned[name] === undefined && issue.code === "invalid_type";
    return { name, message: missing ? "is required (not set)" : issue.message };
  });
  throw new EnvValidationError(issues);
}
