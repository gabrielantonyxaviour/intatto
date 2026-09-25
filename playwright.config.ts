import { defineConfig, devices } from "@playwright/test"

/** Set UI_BASE_URL to check a running deployment; otherwise the web app's dev server is started on :3100. */
const external = process.env.UI_BASE_URL

export default defineConfig({
  testDir: "checks/ui",
  // Test artifacts; checks/ui/.results should be listed in the root .gitignore.
  outputDir: `checks/ui/.results/${process.pid}`,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: external ?? "http://127.0.0.1:3100",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: "pnpm -C web dev --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
