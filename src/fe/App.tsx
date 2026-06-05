/**
 * App — root component.
 *
 * Owns:
 *   - Data fetch lifecycle (ADR-003: BASE_URL fetch)
 *   - status: 'loading' | 'error' | 'ready'
 *   - skills: SkillEntry[] (full, unfiltered)
 *   - metadata: SkillsMetadata | null
 *   - query: string (search state)
 *   - liveMessage: string (aria-live copy feedback — one region per page)
 *
 * The Junior implements each status branch per ADR-005 and user-flows.md.
 * Do NOT change the fetch URL or status state machine structure.
 */

import { useState, useEffect, useMemo } from "react";
import type { SkillsCatalog, SkillEntry, SkillsMetadata } from "../types/skills.js";
import { SearchBar } from "./components/SearchBar.js";
import { SkillList } from "./components/SkillList.js";
import { ScannedReposIndicator } from "./components/ScannedReposIndicator.js";

type Status = "loading" | "error" | "ready";

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [metadata, setMetadata] = useState<SkillsMetadata | null>(null);
  const [query, setQuery] = useState<string>("");
  // One aria-live region for copy feedback — passed as callback to CopyButton via SkillList
  const [liveMessage, setLiveMessage] = useState<string>("");

  // ADR-003: fetch via BASE_URL so the path is correct in both dev and production.
  // Dev:  BASE_URL = '/'  → /data/skills.json
  // Prod: BASE_URL = '/github-skill-scanner/' → /github-skill-scanner/data/skills.json
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}data/skills.json`;
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${url}`);
        }
        return res.json() as Promise<SkillsCatalog>;
      })
      .then((catalog) => {
        setSkills(catalog.skills);
        setMetadata(catalog.metadata);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[app] Failed to load skills catalog:", err);
        setStatus("error");
      });
  }, []);

  // Filtered list — recomputed as query changes. Case-insensitive match on name, description, and skillName.
  // null-coerce to '' so null fields don't crash the filter.
  // Match on skillName too so skills with null names remain discoverable (per user-flows.md).
  const filteredSkills = useMemo(() => {
    if (!query.trim()) return skills;
    const q = query.toLowerCase();
    return skills.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.skillName.toLowerCase().includes(q)
    );
  }, [skills, query]);

  // Determine if SearchBar should be disabled
  const isSearchDisabled = status !== "ready" || skills.length === 0;

  // Format lastScanned as human-readable date, or return null if invalid
  const formatLastScanned = (isoString: string | null | undefined): string | null => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null; // Invalid date
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  };

  const lastScannedDate = status === "ready" ? formatLastScanned(metadata?.lastScanned) : null;

  return (
    <main>
      {/* Aria-live region — one per page; CopyButton updates this via onCopy callback */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <header>
        <h1>GitHub Skill Scanner</h1>
        <p>Agent skills across the ecosystem</p>
        {lastScannedDate && <p className="last-scanned">Last scanned: {lastScannedDate}</p>}
        {status === "ready" &&
          Array.isArray(metadata?.repos) &&
          (metadata?.repos?.length ?? 0) > 0 && (
            <ScannedReposIndicator repos={metadata!.repos} />
          )}
      </header>

      <section aria-label="Skill catalog" aria-busy={status === "loading"}>
        {/* State 1: Loading */}
        {status === "loading" && (
          <>
            <SearchBar value={query} onChange={setQuery} disabled={true} />
            <p>Loading skills...</p>
          </>
        )}

        {/* State 2: Error */}
        {status === "error" && (
          <>
            <SearchBar value={query} onChange={setQuery} disabled={true} />
            <div role="alert" className="state-message">
              <h2>Could not load the skill catalog.</h2>
              <p>
                Try reloading the page. If the problem persists, the data may be temporarily
                unavailable.
              </p>
            </div>
          </>
        )}

        {/* States 3-5: Ready */}
        {status === "ready" && (
          <>
            <SearchBar value={query} onChange={setQuery} disabled={isSearchDisabled} />
            <SkillList
              skills={filteredSkills}
              totalSkillCount={skills.length}
              query={query}
              onCopy={setLiveMessage}
            />
          </>
        )}
      </section>
    </main>
  );
}
