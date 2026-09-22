// Service worker entry point. Listeners MUST be registered synchronously at
// the top level (startSmartBuy.md §6 rule 7) — the worker can be killed and
// restarted between events, so nothing here may depend on module-level state
// surviving between calls.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

// Scheduler, matcher/dedup and notifier listeners are wired in tasks #4/#5.
