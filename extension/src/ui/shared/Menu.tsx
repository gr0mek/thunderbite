import { useEffect, useRef, useState } from "preact/hooks";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  label: string;
}

/** The "⋯" menu used on watch rows (uxSmartBuy.md §5.2: "Menu ⋯: Edytuj ·
 * Sprawdź teraz · Usuń"). */
export function Menu({ items, label }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  return (
    <div class="menu" ref={ref}>
      <button
        type="button"
        class="menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div class="menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              class={`menu-item ${item.danger ? "menu-item--danger" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
