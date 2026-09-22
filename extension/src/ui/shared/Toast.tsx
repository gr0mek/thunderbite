import { copy } from "@/shared/copy.pl";

export interface ToastState {
  id: number;
  message: string;
  onUndo?: (() => void) | undefined;
}

export function Toast({ message, onUndo }: Omit<ToastState, "id">) {
  return (
    <div class="toast" role="status" aria-live="polite">
      <span>{message}</span>
      {onUndo && (
        <button type="button" class="banner-action" onClick={onUndo}>
          {copy.toast.undo}
        </button>
      )}
    </div>
  );
}
