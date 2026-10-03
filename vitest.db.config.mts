import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the local database (`npm run test:db`): stock ledger, reservations and
// the last-bottle race. They create their own test fragrance and remove it afterwards.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["dotenv/config"],
  },
});
