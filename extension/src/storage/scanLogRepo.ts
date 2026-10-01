import { ScanRecordSchema, type ScanRecord } from "@/shared/schemas";
import type { RootStore } from "./rootStore";

export const MAX_SCAN_RECORDS = 100;

/** Ring buffer of recent scans for the diagnostics screen. */
export class ScanLogRepo {
  constructor(private readonly root: RootStore) {}

  /** Newest first. */
  async list(): Promise<ScanRecord[]> {
    return [...(await this.root.read()).scans].reverse();
  }

  async append(record: ScanRecord): Promise<ScanRecord> {
    const validated = ScanRecordSchema.parse(record);
    await this.root.update((state) => ({
      ...state,
      scans: [...state.scans, validated].slice(-MAX_SCAN_RECORDS),
    }));
    return validated;
  }

  async clear(): Promise<void> {
    await this.root.update((state) => ({ ...state, scans: [] }));
  }
}
