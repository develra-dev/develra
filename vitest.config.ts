import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@develra/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@develra/providers": fileURLToPath(
        new URL("./packages/providers/src/index.ts", import.meta.url),
      ),
      "@develra/reporters": fileURLToPath(
        new URL("./packages/reporters/src/index.ts", import.meta.url),
      ),
      develra: fileURLToPath(
        new URL("./apps/cli/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    testTimeout: 20_000,
    pool: "forks",
  },
});
