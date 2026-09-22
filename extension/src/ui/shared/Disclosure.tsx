import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface DisclosureProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ComponentChildren;
}

/** "▸ Więcej filtrów" (uxSmartBuy.md §5.3) — collapsed by default, opens
 * automatically when the caller sets defaultOpen (any advanced field
 * already has a value). */
export function Disclosure({ title, summary, defaultOpen, children }: DisclosureProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        type="button"
        class="disclosure-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾" : "▸"} {title}
      </button>
      {!open && summary && <div class="disclosure-summary">{summary}</div>}
      {open && <div class="col gap3 disclosure-body">{children}</div>}
    </div>
  );
}
