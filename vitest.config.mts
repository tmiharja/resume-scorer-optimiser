import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Unit tests must never reach real services.
    env: { LLM_MOCK: "1", LLM_MOCK_DELAY_MS: "0" },
  },
});
