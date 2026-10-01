import type { DiagnosticsEnvironment } from "@/background/diagnostics";
import type { LogEntry, ScanRecord, SiteHealth } from "@/shared/schemas";

export interface DiagnosticsReportInput {
  environment: DiagnosticsEnvironment | null;
  health: SiteHealth[];
  scans: ScanRecord[];
  logs: LogEntry[];
  generatedAt?: string;
}

/**
 * Plain-JSON report for "Kopiuj raport" — everything needed to debug a
 * failing scan, in one paste. Holds no cookie values, e-mail address or
 * offer data beyond what the scan log already has (search URLs, counts).
 */
export function buildDiagnosticsReport(input: DiagnosticsReportInput): string {
  const report = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    environment: input.environment,
    health: input.health,
    scans: input.scans.slice(0, 20),
    logs: input.logs
      .filter((l) => l.level === "warn" || l.level === "error")
      .slice(0, 30),
  };
  return JSON.stringify(report, null, 2);
}
