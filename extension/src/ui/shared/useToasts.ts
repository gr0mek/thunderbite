import { useCallback, useRef, useState } from "preact/hooks";
import type { ToastState } from "./Toast";

const AUTO_DISMISS_MS = 5000;

/** uxSmartBuy.md §4 F6: a toast with an optional "Cofnij" (undo), no modal. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, onUndo?: () => void) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, onUndo }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      AUTO_DISMISS_MS,
    );
  }, []);

  return { toasts, show };
}
