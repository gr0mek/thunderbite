import type { ComponentChildren } from "preact";

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ComponentChildren;
}

export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label class="checkbox-row">
      <span
        class={`checkbox-box ${checked ? "checkbox-box--checked" : ""}`}
        aria-hidden="true"
      >
        {checked ? "✓" : ""}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
      {children}
    </label>
  );
}
