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
    page.getByText(
      "npx skills add https://github.com/anthropics/skills --skill frontend-design -a github-copilot -y"
    )
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
    "npx skills add https://github.com/anthropics/skills --skill frontend-design -a github-copilot -y"
  );

  // Feedback shows, then reverts after ~2s (QA had the timer as unverified).
  await expect(copyBtn).toHaveText("Copied!");
  await expect(copyBtn).toHaveText("Copy", { timeout: 4000 });
});

// --- SR-1 e2e cases ---

// TC-136: indicator visible, summary shows count, closed by default
test("TC-136: scanned repos indicator visible with correct summary count", async ({ page }) => {
  await page.goto(APP_PATH);

  // The <details> with aria-label must be present
  const details = page.locator("details[aria-label='Scanned repositories']");
  await expect(details).toBeVisible();

  // Summary text: fixture has 3 repos
  const summary = details.locator("summary");
  await expect(summary).toHaveText("Scanning 3 repositories");

  // Closed by default — the <details> element must not have the open attribute
  await expect(details).not.toHaveAttribute("open");
});

// TC-137: expand reveals repo list, failed tag on broken-repo, no tag on empty-repo, 3 links total
test("TC-137: expand reveals repo list with correct links and failed tag", async ({ page }) => {
  await page.goto(APP_PATH);

  // Expand the details
  const summary = page.locator("details[aria-label='Scanned repositories'] summary");
  await summary.click();

  const repoList = page.locator("details[aria-label='Scanned repositories'] ul");
  await expect(repoList).toBeVisible();

  // All 3 repos are present as links
  const repoItems = repoList.locator("li");
  await expect(repoItems).toHaveCount(3);

  // anthropics/skills link
  const skillsLink = page.getByRole("link", { name: /anthropics\/skills/ }).filter({ hasNot: page.locator("span.visually-hidden") });
  // Use a more reliable locator: find the anchor in the list with matching text
  const skillsAnchor = repoList.locator("a").filter({ hasText: "anthropics/skills" });
  await expect(skillsAnchor).toHaveAttribute("href", "https://github.com/anthropics/skills");

  // someorg/broken-repo shows "scan failed" tag
  const brokenItem = repoList.locator("li").filter({ hasText: "someorg/broken-repo" });
  await expect(brokenItem.locator("span.repo-scan-failed")).toBeVisible();
  await expect(brokenItem.locator("span.repo-scan-failed")).toHaveText("scan failed");

  // someorg/empty-repo does NOT have a "scan failed" tag
  const emptyItem = repoList.locator("li").filter({ hasText: "someorg/empty-repo" });
  await expect(emptyItem.locator("span.repo-scan-failed")).toHaveCount(0);
});

// TC-138: existing autofocus test still passes with indicator present
// (Validated by re-running the client-side search test which checks autofocus)
test("TC-138: autofocus on search input not broken by indicator presence", async ({ page }) => {
  await page.goto(APP_PATH);

  const search = page.getByRole("searchbox");
  await expect(search).toBeFocused();
});

// TC-139: copy command string unchanged — ends with -a github-copilot -y (TC-139 regression)
test("TC-139: copy command string unchanged after SR-1 change", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(APP_PATH);

  const copyBtn = page.getByRole("button", {
    name: "Copy install command for Frontend Design",
  });
  await copyBtn.click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(
    "npx skills add https://github.com/anthropics/skills --skill frontend-design -a github-copilot -y"
  );
});

// TC-160: body background is the dark --bg color (rgb(13, 17, 23) = #0d1117).
// Permanent regression guard: confirms the full-viewport dark background is applied
// and has not been accidentally overridden by a browser default.
test("TC-160: body background is the dark --bg color", async ({ page }) => {
  await page.goto(APP_PATH);
  const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bgColor).toBe("rgb(13, 17, 23)");
});

// TC-161: span.repo-scan-failed color is the new #848d97, not the old failing #999.
// Expand the disclosure first so the failed-repo tag is rendered.
test("TC-161: span.repo-scan-failed color is not the old rgb(153,153,153)", async ({
  page,
}) => {
  await page.goto(APP_PATH);

  // Expand the disclosure so span.repo-scan-failed is in the DOM.
  await page.locator("details[aria-label='Scanned repositories'] summary").click();

  const color = await page.evaluate(() => {
    const span = document.querySelector("span.repo-scan-failed");
    if (!span) throw new Error("span.repo-scan-failed not found");
    return getComputedStyle(span).color;
  });

  // Must NOT be the old #999 value (fails WCAG AA for small text on white).
  expect(color).not.toBe("rgb(153, 153, 153)");
  // Must be the new token value: #848d97 = rgb(132, 141, 151).
  expect(color).toBe("rgb(132, 141, 151)");
});

// TC-163: ::before terminal prompt does not affect textContent.
// The "$ " is CSS-only (user-select: none) and must NOT appear in the element's
// textContent — Playwright getByText uses textContent, so the existing install
// command visibility test must still pass unchanged.
test("TC-163: code::before prompt does not alter element textContent", async ({ page }) => {
  await page.goto(APP_PATH);

  // Wait for the catalog to render before reading the DOM (BUG-002: the fetch +
  // React render is async; querying immediately after goto returns null).
  await page.locator(".skill-card code").first().waitFor();

  // textContent of the <code> element must be the bare command string, no "$ " prefix.
  const textContent = await page.evaluate(() => {
    const code = document.querySelector(".skill-card code");
    if (!code) throw new Error("skill-card code element not found");
    return code.textContent;
  });

  expect(textContent).toBe(
    "npx skills add https://github.com/anthropics/skills --skill frontend-design -a github-copilot -y"
  );
});

// TC-144: no horizontal scrollbar at 320px (requirements must-have), with the
// scanned-repos disclosure expanded (the widest header content state).
test("TC-144: no horizontal overflow at 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(APP_PATH);

  // Expand the repos disclosure — the longest repo slug is the widest header row.
  await page.locator("details[aria-label='Scanned repositories'] summary").click();

  // The document must not scroll horizontally at this width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});
