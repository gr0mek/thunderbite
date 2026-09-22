import type { ComponentChildren } from "preact";

interface EmptyStateProps {
  icon?: ComponentChildren;
  message: string;
  action?: ComponentChildren;
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div class="empty-state">
      {icon ?? (
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: "1px dashed var(--line)",
          }}
        />
      )}
      <span class="text-body" style={{ color: "var(--ink-muted)" }}>
        {message}
      </span>
      {action}
    </div>
  );
}
