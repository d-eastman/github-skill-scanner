/**
 * CopyButton — copies the install command to clipboard with feedback.
 *
 * Props:
 *   - skill: the SkillEntry to copy
 *   - onCopy: callback fired on success or failure with a message for aria-live announcement
 *
 * Behavior:
 *   - Build command via buildInstallCommand() — shared with SkillCard so the
 *     displayed and copied strings always match (no trailing whitespace)
 *   - On click: call navigator.clipboard.writeText(command)
 *   - On success: show "Copied!" for 2s, then revert to "Copy"
 *   - On failure: show "Failed — try again" for 2s, then revert
 *   - Do not disable the button during feedback window
 *   - Call onCopy callback with appropriate message for aria-live region
 *   - Log success metric: console.log('install_copied', { skillName, repo })
 */

import { useState } from "react";
import type { SkillEntry } from "../../types/skills.js";
import { buildInstallCommand } from "../installCommand.js";

interface CopyButtonProps {
  skill: SkillEntry;
  onCopy: (message: string) => void;
}

export function CopyButton({ skill, onCopy }: CopyButtonProps) {
  const [buttonLabel, setButtonLabel] = useState<"Copy" | "Copied!" | "Failed — try again">(
    "Copy"
  );

  const handleClick = async () => {
    const command = buildInstallCommand(skill);
    const skillDisplayName = skill.name ?? skill.skillName;

    try {
      await navigator.clipboard.writeText(command);

      // Success: show "Copied!" for 2 seconds
      setButtonLabel("Copied!");
      console.log("install_copied", { skillName: skill.skillName, repo: skill.repo });
      onCopy(`Install command for ${skillDisplayName} copied to clipboard.`);

      // Revert after 2 seconds
      setTimeout(() => {
        setButtonLabel("Copy");
      }, 2000);
    } catch (err) {
      // Failure: show "Failed — try again" for 2 seconds
      console.error("[CopyButton] Clipboard write failed:", err);
      setButtonLabel("Failed — try again");
      onCopy(`Copy failed for ${skillDisplayName}. Try again.`);

      // Revert after 2 seconds
      setTimeout(() => {
        setButtonLabel("Copy");
      }, 2000);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={`Copy install command for ${skill.name ?? skill.skillName}`}
    >
      {buttonLabel}
    </button>
  );
}
