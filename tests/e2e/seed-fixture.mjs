/**
 * e2e fixture seeder (TD-003).
 *
 * Overwrites the built dist/data/skills.json with a deterministic fixture so the
 * Playwright suite asserts against known content instead of whatever the last
 * real scan produced. Run after `npm run build`, before `vite preview`.
 */
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "fixtures", "skills.json");
const destDir = join(here, "..", "..", "dist", "data");
const dest = join(destDir, "skills.json");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[e2e] seeded fixture catalog -> ${dest}`);
