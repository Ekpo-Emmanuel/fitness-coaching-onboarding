import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
