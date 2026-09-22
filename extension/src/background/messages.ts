import type { Watch } from "@/shared/schemas";

// Only watch-lifecycle actions that touch chrome.alarms/adapters go through
// the background — everything read-only or storage-only (listing watches,
// listing offers, marking seen/hidden) talks to storage/* directly from
// whichever extension page needs it, since chrome.storage.local and
// IndexedDB are both available outside the service worker too.

export type BackgroundRequest =
  | { type: "watch/create"; input: unknown }
  | { type: "watch/update"; watchId: string; patch: Partial<Watch> }
  | { type: "watch/checkNow"; watchId: string }
  | { type: "watch/pause"; watchId: string }
  | { type: "watch/resume"; watchId: string }
  | { type: "watch/delete"; watchId: string };

export type BackgroundResponse<T = unknown> =
  { ok: true; data: T } | { ok: false; error: string };

export function sendToBackground<T = unknown>(request: BackgroundRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response: BackgroundResponse<T> | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("No response from background"));
        return;
      }
      if (response.ok) resolve(response.data);
      else reject(new Error(response.error));
    });
  });
}

export const createWatch = (input: unknown) =>
  sendToBackground<Watch>({ type: "watch/create", input });
export const updateWatch = (watchId: string, patch: Partial<Watch>) =>
  sendToBackground<Watch>({ type: "watch/update", watchId, patch });
export const checkWatchNow = (watchId: string) =>
  sendToBackground<void>({ type: "watch/checkNow", watchId });
export const pauseWatch = (watchId: string) =>
  sendToBackground<Watch>({ type: "watch/pause", watchId });
export const resumeWatch = (watchId: string) =>
  sendToBackground<Watch>({ type: "watch/resume", watchId });
export const deleteWatch = (watchId: string) =>
  sendToBackground<void>({ type: "watch/delete", watchId });
