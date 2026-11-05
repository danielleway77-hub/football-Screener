import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Architecture boundaries (docs ARCHITECTURE.md §2):
 *   app/ ──▶ server/services ──▶ server/repositories ──▶ lib/db (Prisma)
 *   components/ never touch the database; server/domain is pure (no Next, React or Prisma).
 */
const prismaPatterns = [
  {
    group: ["@prisma/*", "@/lib/db", "@/lib/db/*"],
    message: "Only src/server/repositories (and src/lib/db.ts) may use Prisma.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // UI code: no database access, no repositories (go through server components/services).
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...prismaPatterns,
            {
              group: ["@/server/repositories", "@/server/repositories/*"],
              message: "Components must not import repositories; use services via server code.",
            },
          ],
        },
      ],
    },
  },
  // Domain code is pure business logic: no framework, no database, no outer layers.
  {
    files: ["src/server/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...prismaPatterns,
            {
              group: ["next", "next/*", "react", "react-dom", "react/*", "server-only"],
              message: "src/server/domain must stay framework-free (no Next/React imports).",
            },
            {
              group: [
                "@/components/*",
                "@/app/*",
                "@/hooks/*",
                "@/lib/env",
                "@/lib/env.public",
                "@/server/repositories",
                "@/server/repositories/*",
                "@/server/services",
                "@/server/services/*",
                "@/server/providers",
                "@/server/providers/*",
                "@/server/auth",
                "@/server/auth/*",
              ],
              message: "src/server/domain must not import from outer layers.",
            },
          ],
        },
      ],
    },
  },
  // Scripts and tests may print to the console.
  {
    files: ["scripts/**/*.{ts,mjs,js}", "tests/**/*.{ts,tsx}"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
