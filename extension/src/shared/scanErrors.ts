import type { ScanErrorCode, Transport } from "./schemas";

/** An error with a stable diagnostic code (see SCAN_ERROR_CODES). */
export class ScanError extends Error {
  constructor(
    readonly code: ScanErrorCode,
    message: string,
    readonly details: {
      status?: number | undefined;
      url?: string | undefined;
      via?: Transport | undefined;
      snippet?: string | undefined;
    } = {},
  ) {
    super(message);
    this.name = "ScanError";
  }
}

export function codeForHttpStatus(status: number): ScanErrorCode {
  if (status === 401) return "VNT-401";
  if (status === 403) return "VNT-403";
  if (status === 404) return "VNT-404";
  if (status === 429) return "VNT-429";
  if (status >= 500) return "VNT-5XX";
  return "VNT-HTTP";
}

/** Normalizes anything thrown during a scan into a ScanError. */
export function toScanError(err: unknown): ScanError {
  if (err instanceof ScanError) return err;
  if (
    err instanceof DOMException &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  ) {
    return new ScanError("VNT-TIMEOUT", err.message || "Request timed out");
  }
  const message = err instanceof Error ? err.message : String(err);
  return new ScanError("APP-UNKNOWN", message);
}
