import { defineConfig, devices } from "@playwright/test";

// Runs the built HUD with `vite preview` and mocks every backend call (HTTP API, WebSocket,
// Cognito). Nothing leaves the machine.
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
    cwd: import.meta.dirname,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: /(phone|safari)\.spec\.ts/,
    },
    // Safari's engine for the voice path (the owner talks in Mac Safari): `npx playwright install webkit`.
    { name: "safari", use: { ...devices["Desktop Safari"] }, testMatch: /safari\.spec\.ts/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /phone\.spec\.ts/ },
  ],
});
