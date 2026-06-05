import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ADR-003: base path set to the GitHub Pages project site path.
// The frontend fetches data/skills.json via `${import.meta.env.BASE_URL}data/skills.json`
// so the URL is correct in both dev (BASE_URL = '/') and production (BASE_URL = '/github-skill-scanner/').
export default defineConfig({
  plugins: [react()],
  base: "/github-skill-scanner/",
  root: "src/fe",
  publicDir: "public",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
