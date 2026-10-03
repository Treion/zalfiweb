import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for business logic (no browser, no database): `npm test`
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
