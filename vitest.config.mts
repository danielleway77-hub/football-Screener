import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // `server-only` throws outside the React server bundle; tests run in plain Node.
  "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only-stub.ts"),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "tests/ui/**"],
    // Two projects: pure Node (domain, services, API) and jsdom (React components).
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.ts",
            "src/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "tests/unit/**/*.test.tsx",
            "tests/components/**/*.test.tsx",
            "src/**/*.test.tsx",
          ],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/server/domain/**/*.ts", "src/server/services/**/*.ts"],
      // Thresholds are switched on in Step 7 (domain >= 95%) and Step 8 (services >= 85%),
      // when those folders contain code; enforcing them on empty folders would be meaningless.
    },
  },
});
