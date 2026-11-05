import "server-only";
import { parseServerEnv } from "./env-schema";

/**
 * Typed, validated server environment. Importing this module in client code is a build error
 * (`server-only`). It is imported once at server start by `src/instrumentation.ts`, so a bad or
 * missing variable stops the app immediately with a readable message instead of failing later.
 */
export const env = parseServerEnv(process.env);
