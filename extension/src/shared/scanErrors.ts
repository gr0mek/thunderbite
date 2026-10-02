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

/** Code prefix per site: VNT-… for Vinted, EBY-… for eBay. */
export type ScanErrorPrefix = "VNT" | "EBY";

export function codeForHttpStatus(
  status: number,
  prefix: ScanErrorPrefix = "VNT",
): ScanErrorCode {
  if (status === 401) return `${prefix}-401`;
  if (status === 403) return `${prefix}-403`;
  if (status === 404) return `${prefix}-404`;
  if (status === 429) return `${prefix}-429`;
  if (status >= 500) return `${prefix}-5XX`;
  return `${prefix}-HTTP`;
}

/** Normalizes anything thrown during a scan into a ScanError. */
export function toScanError(err: unknown, prefix: ScanErrorPrefix = "VNT"): ScanError {
  if (err instanceof ScanError) return err;
  if (
    err instanceof DOMException &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  ) {
    return new ScanError(`${prefix}-TIMEOUT`, err.message || "Request timed out");
  }
  const message = err instanceof Error ? err.message : String(err);
  return new ScanError("APP-UNKNOWN", message);
}
