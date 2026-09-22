import { copy } from "@/shared/copy.pl";

interface TabsProps {
  active: "new" | "watching";
  newCount: number;
  watchingCount: number;
  onChange: (tab: "new" | "watching") => void;
}

export function Tabs({ active, newCount, watchingCount, onChange }: TabsProps) {
  return (
    <div class="fx gap6 popup-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === "new"}
        class={`popup-tab ${active === "new" ? "popup-tab--active" : ""}`}
        onClick={() => onChange("new")}
      >
        {copy.tabs.new}
        {newCount > 0 && <span class="badge-count">{newCount}</span>}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "watching"}
        class={`popup-tab ${active === "watching" ? "popup-tab--active" : ""}`}
        onClick={() => onChange("watching")}
      >
        {copy.tabs.watching} <span class="text-meta">{watchingCount}</span>
      </button>
    </div>
  );
}
