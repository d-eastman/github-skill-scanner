/**
 * ScannedReposIndicator — shows the list of repos included in the scan.
 *
 * Renders a native <details>/<summary> disclosure widget. Collapsed by default.
 * Summary text: "Scanning N repository/repositories"
 * Expanded list: repo links with a "scan failed" tag for failed repos.
 *
 * Props:
 *   - repos: ScannedRepo[] — the list of repos from metadata.repos.
 *     Caller is responsible for the render guard (status === "ready" && length > 0).
 *
 * This component owns no state. All open/close behavior is native to <details>.
 *
 * Accessibility:
 *   - aria-label="Scanned repositories" on <details> for screen reader landmark naming
 *   - Repo links use the same visually-hidden "(opens in new tab)" pattern as SkillCard
 *   - "scan failed" <span> reads naturally in sequence: "{repo} (link), scan failed"
 */

import type { ScannedRepo } from "../../types/skills.js";

interface ScannedReposIndicatorProps {
  repos: ScannedRepo[];
}

export function ScannedReposIndicator({ repos }: ScannedReposIndicatorProps) {
  const count = repos.length;
  const summaryText = `Scanning ${count} ${count === 1 ? "repository" : "repositories"}`;

  return (
    <details className="scanned-repos" aria-label="Scanned repositories">
      <summary>{summaryText}</summary>
      <ul className="scanned-repos-list">
        {repos.map((r) => (
          <li key={r.repo}>
            <a href={r.repoUrl} target="_blank" rel="noopener noreferrer">
              {r.repo}
              <span className="visually-hidden"> (opens in new tab)</span>
            </a>
            {r.status === "failed" && (
              <span className="repo-scan-failed"> scan failed</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
