import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 does not read .env files itself. PRISMA_ENV=test points the CLI at the isolated `test` schema.
const isTest = process.env.PRISMA_ENV === "test";
for (const file of isTest ? [".env.test.local"] : [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const url = isTest ? process.env.DIRECT_URL_TEST : process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: url ?? "" },
});
