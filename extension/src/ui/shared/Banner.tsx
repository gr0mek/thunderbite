import type { ComponentChildren } from "preact";

interface BannerProps {
  variant?: "info" | "warn";
  children: ComponentChildren;
  action?: { label: string; onClick: () => void };
}

/** uxSmartBuy.md §6 "Paski systemowe" — offline, notifications-disabled,
 * service-problem, watch-limit banners all share this shape. */
export function Banner({ variant = "info", children, action }: BannerProps) {
  return (
    <div class={`banner ${variant === "warn" ? "banner--warn" : ""}`}>
      <span>{children}</span>
      {action && (
        <button type="button" class="banner-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
