import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["packages/*/test/**/*.test.ts", "services/*/test/**/*.test.ts", "tests/**/*.test.ts"],
        },
      },
      "web/vitest.config.ts",
    ],
  },
});
