import type { ComponentChildren } from "preact";

interface ModalProps {
  title: string;
  children: ComponentChildren;
  onClose: () => void;
}

/** The app's one modal (uxSmartBuy.md §5.4: "jedyny modal potwierdzenia w
 * aplikacji" — delete-all-data). */
export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="text-title" style={{ marginBottom: 8 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
