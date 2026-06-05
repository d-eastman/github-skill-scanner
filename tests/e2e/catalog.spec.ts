import { test, expect } from "@playwright/test";

/**
 * e2e suite (TD-003) — runs against the built bundle served by `vite preview`
 * at the real GitHub Pages base path (`/github-skill-scanner/`). Catalog content
 * is the deterministic fixture seeded by tests/e2e/seed-fixture.mjs (2 skills).
 */

const APP_PATH = "/github-skill-scanner/";

test("serves skills.json at the production base path (the 404-in-prod regression)", async ({
  request,
}) => {
  // This is the core ADR-003 risk: a base-path mismatch makes this 404 in prod.
  const res = await request.get(`${APP_PATH}data/skills.json`);
  expect(res.ok()).toBeTruthy();
  const catalog = await res.json();
  expect(Array.isArray(catalog.skills)).toBe(true);
  expect(catalog.skills.length).toBe(2);
});

test("loads the app and renders skill cards without hitting the error state", async ({ page }) => {
  await page.goto(APP_PATH);

  await expect(page.getByRole("heading", { level: 1, name: "GitHub Skill Scanner" })).toBeVisible();

  // The error/empty states must NOT appear — the data fetch succeeded.
  await expect(page.getByText("Could not load the skill catalog.")).toHaveCount(0);
  await expect(page.getByText("No skills found yet.")).toHaveCount(0);

  // Two cards from the fixture.
  const cards = page.locator("ul.skill-list > li");
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 2, name: "Frontend Design" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "PDF Processing" })).toBeVisible();

  // Install command is rendered verbatim for the first skill.
  await expect(
    page.getByText("npx skills add https://github.com/anthropics/skills --skill frontend-design")
  ).toBeVisible();
});

test("client-side search filters the catalog in real time", async ({ page }) => {
  await page.goto(APP_PATH);

  const search = page.getByRole("searchbox");
  await expect(search).toBeVisible();
  // Autofocus on load (must-have #7).
  await expect(search).toBeFocused();

  await search.fill("frontend");
  const cards = page.locator("ul.skill-list > li");
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Frontend Design" })).toBeVisible();

  // A query matching nothing shows the distinct no-results state, not the empty state.
  await search.fill("zzz-no-match");
  await expect(page.getByText(/No skills match/)).toBeVisible();
  await expect(page.getByText("No skills found yet.")).toHaveCount(0);

  // Clearing restores the full catalog.
  await search.fill("");
  await expect(cards).toHaveCount(2);
});

test("copy button writes the command and shows then reverts feedback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(APP_PATH);

  const copyBtn = page.getByRole("button", {
    name: "Copy install command for Frontend Design",
  });
  await expect(copyBtn).toHaveText("Copy");

  await copyBtn.click();

  // Real-browser confirmation of the copied string (QA had this as unverified).
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(
    "npx skills add https://github.com/anthropics/skills --skill frontend-design"
  );

  // Feedback shows, then reverts after ~2s (QA had the timer as unverified).
  await expect(copyBtn).toHaveText("Copied!");
  await expect(copyBtn).toHaveText("Copy", { timeout: 4000 });
});
