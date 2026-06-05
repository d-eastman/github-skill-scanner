/**
 * SkillCard — renders a single skill with name, description, repo link, command, and copy button.
 *
 * Props:
 *   - skill: the SkillEntry to render
 *   - onCopy: callback fired by CopyButton for aria-live announcement
 *
 * Renders:
 *   - Name: <h2>{name ?? skillName}</h2> (fallback to skillName if name is null)
 *   - Description: <p>{description}</p> only if description is not null
 *   - Repo link: <a href={repoUrl} target="_blank" rel="noopener noreferrer">
 *       {repo}<span className="visually-hidden"> (opens in new tab)</span></a>
 *   - Install command: <code>npx skills add {repoUrl} --skill {skillName}</code>
 *   - CopyButton
 */

import type { SkillEntry } from "../../types/skills.js";
import { CopyButton } from "./CopyButton.js";

interface SkillCardProps {
  skill: SkillEntry;
  onCopy: (message: string) => void;
}

export function SkillCard({ skill, onCopy }: SkillCardProps) {
  const skillDisplayName = skill.name ?? skill.skillName;

  return (
    <article className="skill-card">
      <h2>{skillDisplayName}</h2>
      {skill.description && <p>{skill.description}</p>}
      <p>
        Source:{" "}
        <a href={skill.repoUrl} target="_blank" rel="noopener noreferrer">
          {skill.repo}
          <span className="visually-hidden"> (opens in new tab)</span>
        </a>
      </p>
      <code>{`npx skills add ${skill.repoUrl} --skill ${skill.skillName}`}</code>
      <CopyButton skill={skill} onCopy={onCopy} />
    </article>
  );
}
