import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config (TD-003).
 *
 * The point of these tests is to catch the "works in dev, 404s in prod"
 * base-path risk (ADR-003): the app is served under `/github-skill-scanner/`
 * and must fetch `/github-skill-scanner/data/skills.json` correctly. We run
 * against `vite preview` (the real built bundle at the real base path), not the
 * dev server, so the base path is exercised exactly as on GitHub Pages.
 *
 * Run with: npm run test:e2e  (builds, seeds a fixture catalog, then tests).
 */

const HOST = "http://localhost:4173";
const APP_URL = `${HOST}/github-skill-scanner/`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: HOST,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The build + fixture seed happen in the `test:e2e` script before Playwright
    // starts; here we only need to serve the already-built dist/.
    command: "npm run preview",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
