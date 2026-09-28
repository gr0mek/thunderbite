import { useState } from "preact/hooks";
import type { JSX } from "preact";

interface ChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  max?: number;
}

/** uxSmartBuy.md §5.3: "Enter w polu chipów dodaje chip. Backspace w
 * pustym polu usuwa ostatni." Used for both name variants and excluded
 * words. */
export function ChipInput({ value, onChange, addLabel, max = 10 }: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && value.length < max && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
    setEditing(false);
  }

  function onKeyDown(e: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div class="fx wrap gap2">
      {value.map((v) => (
        <span class="chip" key={v}>
          {v}
          <button
            type="button"
            class="chip-remove"
            aria-label={`Usuń ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
          >
            ×
          </button>
        </span>
      ))}
      {editing ? (
        <input
          autoFocus
          class="chip-input-field"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      ) : (
        value.length < max && (
          <button type="button" class="chip-add" onClick={() => setEditing(true)}>
            {addLabel}
          </button>
        )
      )}
    </div>
  );
}
