import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // The pure-logic libraries. Server glue that needs a database is covered by the SQL tests and Playwright instead.
      include: ["src/lib/{pricing,account,security,seo,i18n,admin,reviews}/**/*.ts", "src/lib/{money,consent,observability}.ts"],
      // Modules that only read the database or the request (`server-only`), or bind data to a framework API.
      exclude: ["**/*.test.ts", "**/server.ts", "**/service.ts", "**/deps.ts", "**/index.ts", "**/types.ts", "**/session.ts", "**/trips.ts", "**/staff.ts", "**/load-config.ts", "**/dictionary.ts", "**/messages.ts", "**/calendar-locale.ts", "**/metadata.ts"],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 80 },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
