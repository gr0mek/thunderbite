import type { ComponentChildren } from "preact";

interface FieldProps {
  label: string;
  children: ComponentChildren;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div class="field-label">{label}</div>
      {children}
    </div>
  );
}
