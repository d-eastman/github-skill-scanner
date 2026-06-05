/**
 * SearchBar — controlled text input for filtering skills.
 *
 * Props:
 *   - value: current search query string
 *   - onChange: callback fired on every keystroke
 *   - disabled: whether the input is disabled (loading, error, empty states)
 *
 * Renders:
 *   - Visually hidden <label> for WCAG 1.3.1 compliance
 *   - <input type="search"> with autofocus (when not disabled) and native clear button
 */

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  disabled: boolean;
}

export function SearchBar({ value, onChange, disabled }: SearchBarProps) {
  return (
    <>
      <label htmlFor="search-input" className="sr-only">
        Search skills
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Search skills..."
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
        autoFocus={!disabled}
      />
    </>
  );
}
