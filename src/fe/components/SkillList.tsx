/**
 * SkillList — renders the filtered skill list or state messages.
 *
 * Props:
 *   - skills: the filtered array (may be empty)
 *   - totalSkillCount: the unfiltered total (to distinguish empty from no-results)
 *   - query: the current search query
 *   - onCopy: callback passed to SkillCard/CopyButton for aria-live announcement
 *
 * Renders:
 *   - If totalSkillCount === 0: empty state message (catalog has zero skills)
 *   - If skills.length === 0 && query !== '': no-results message (search filtered everything)
 *   - Otherwise: <ul> of <li><SkillCard> elements
 *
 * List keys: repo + '/' + path (skillName is not globally unique)
 */

import type { SkillEntry } from "../../types/skills.js";
import { SkillCard } from "./SkillCard.js";

interface SkillListProps {
  skills: SkillEntry[];
  totalSkillCount: number;
  query: string;
  onCopy: (message: string) => void;
}

export function SkillList({ skills, totalSkillCount, query, onCopy }: SkillListProps) {
  // Empty state: catalog has zero skills
  if (totalSkillCount === 0) {
    return (
      <div className="state-message">
        <h2>No skills found yet.</h2>
        <p>
          The scanner has run but found no SKILL.md files in the configured repositories.
        </p>
      </div>
    );
  }

  // No-results state: search filtered everything out
  if (skills.length === 0 && query !== "") {
    // Truncate query to 30 chars for display
    const displayQuery = query.length > 30 ? `${query.substring(0, 30)}…` : query;
    return (
      <div className="state-message">
        <h2>No skills match "{displayQuery}".</h2>
        <p>Try a different search term, or clear the search to browse all skills.</p>
      </div>
    );
  }

  // Populated state: render list of skill cards
  return (
    <ul className="skill-list">
      {skills.map((skill) => (
        <li key={`${skill.repo}/${skill.path}`}>
          <SkillCard skill={skill} onCopy={onCopy} />
        </li>
      ))}
    </ul>
  );
}
