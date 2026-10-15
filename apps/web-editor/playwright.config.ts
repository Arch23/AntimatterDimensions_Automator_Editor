import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test-e2e",
  fullyParallel: true,
  workers: 1,
  globalSetup: "./test-e2e/global-setup.mjs",
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    headless: true
  }
});
