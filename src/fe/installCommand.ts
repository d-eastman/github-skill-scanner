import type { SkillEntry } from "../types/skills.js";

/**
 * The install command shown on each skill card AND copied to the clipboard.
 *
 * Single source of truth: the displayed `<code>` (SkillCard) and the clipboard
 * write (CopyButton) must always match, so both build the command from here.
 *
 * Format: `npx skills add <repoUrl> --skill <skillName> -a github-copilot -y`
 * (`-a github-copilot` targets the GitHub Copilot agent; `-y` skips the prompt.)
 */
export function buildInstallCommand(skill: SkillEntry): string {
  return `npx skills add ${skill.repoUrl} --skill ${skill.skillName} -a github-copilot -y`;
}
