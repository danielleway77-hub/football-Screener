import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serverEnvSchema } from "@/lib/env-schema";

const root = path.resolve(import.meta.dirname, "../..");
const example = readFileSync(path.join(root, ".env.example"), "utf8");

/** Variables documented for tests/tooling only; the app never reads them. */
const TEST_ONLY = ["DATABASE_URL_TEST", "DIRECT_URL_TEST", "E2E_PASSWORD"];
/** Provided by the runtime, never set by the owner. */
const RUNTIME_ONLY = ["NODE_ENV"];

const active = new Set<string>();
const commented = new Set<string>();
for (const line of example.split(/\r?\n/)) {
  const a = line.match(/^([A-Z][A-Z0-9_]*)=/);
  if (a) active.add(a[1]!);
  const c = line.match(/^#\s*([A-Z][A-Z0-9_]*)=/);
  if (c) commented.add(c[1]!);
}
const documented = new Set([...active, ...commented]);
const schemaKeys = Object.keys(serverEnvSchema.shape);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "generated") walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe(".env.example vs env schema", () => {
  it("documents every schema variable (except runtime-provided ones)", () => {
    const missing = schemaKeys.filter((k) => !RUNTIME_ONLY.includes(k) && !documented.has(k));
    expect(missing).toEqual([]);
  });

  it("contains no variable the schema does not know (except test-only ones)", () => {
    const extra = [...documented].filter((k) => !schemaKeys.includes(k) && !TEST_ONLY.includes(k));
    expect(extra).toEqual([]);
  });

  it("has every REQUIRED schema variable uncommented", () => {
    const optional = schemaKeys.filter(
      (k) =>
        serverEnvSchema.shape[k as keyof typeof serverEnvSchema.shape].safeParse(undefined).success,
    );
    const required = schemaKeys.filter((k) => !optional.includes(k));
    expect(required.filter((k) => !active.has(k))).toEqual([]);
  });

  it("keeps optional variables commented out (an empty value must not be shipped as active)", () => {
    const optional = schemaKeys.filter(
      (k) =>
        serverEnvSchema.shape[k as keyof typeof serverEnvSchema.shape].safeParse(undefined).success,
    );
    expect(optional.filter((k) => active.has(k))).toEqual([]);
  });

  it("exposes only NEXT_PUBLIC_APP_URL to the browser, and it is not secret-looking", () => {
    const publicNames = [...documented].filter((k) => k.startsWith("NEXT_PUBLIC_"));
    expect(publicNames).toEqual(["NEXT_PUBLIC_APP_URL"]);
    const used = new Set<string>();
    for (const file of walk(path.join(root, "src"))) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const m of code.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) used.add(m[0]);
    }
    expect([...used].sort()).toEqual(["NEXT_PUBLIC_APP_URL"]);
    expect(publicNames.some((k) => /SECRET|KEY|TOKEN|PASSWORD|HASH|DATABASE/.test(k))).toBe(false);
  });

  it("ships placeholders only, never a real secret or credential", () => {
    const values = example.split(/\r?\n/).filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l));
    for (const line of values) {
      const [name, ...rest] = line.split("=");
      const value = rest.join("=");
      if (/SECRET|HASH|PASSWORD/.test(name!)) expect(value, name).toBe("");
      if (/^(DATABASE|DIRECT)_URL/.test(name!)) expect(value, name).toContain("USER:PASSWORD@");
    }
    expect(example).not.toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
  });

  it("vercel.json cron points at an existing route and is daily", () => {
    const cfg = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(cfg.crons).toHaveLength(1);
    expect(cfg.crons[0]!.path).toBe("/api/cron/daily");
    expect(cfg.crons[0]!.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
    expect(statSync(path.join(root, "src/app/api/cron/daily/route.ts")).isFile()).toBe(true);
  });
});
