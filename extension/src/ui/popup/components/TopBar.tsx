import { BrandMark } from "@/ui/shared/BrandMark";

export function TopBar() {
  return (
    <div class="fx ac jb popup-topbar">
      <span class="fx ac gap2">
        <BrandMark />
        <span class="brand-name">Thunder Bait</span>
      </span>
      <button
        type="button"
        class="icon-btn"
        aria-label="Ustawienia"
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        ⚙
      </button>
    </div>
  );
}
