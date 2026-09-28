import type { LogRepo } from "@/storage/logRepo";

// startSmartBuy.md §7: "Logger z poziomami (debug/info/warn/error), bufor
// ostatnich ~500 wpisów w storage, podgląd w opcjach. Bez logowania danych
// osobowych." The ring buffer itself lives in LogRepo (storage layer); this
// wraps it with the app-facing API and mirrors to the console so `debug`
// during development doesn't require opening the options page.
export class Logger {
  constructor(private readonly repo: LogRepo) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    void this.repo.append("debug", message, meta);
    console.debug(`[thunder-bait] ${message}`, meta ?? "");
  }

  info(message: string, meta?: Record<string, unknown>): void {
    void this.repo.append("info", message, meta);
    console.info(`[thunder-bait] ${message}`, meta ?? "");
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    void this.repo.append("warn", message, meta);
    console.warn(`[thunder-bait] ${message}`, meta ?? "");
  }

  error(message: string, meta?: Record<string, unknown>): void {
    void this.repo.append("error", message, meta);
    console.error(`[thunder-bait] ${message}`, meta ?? "");
  }
}
