import { LogEntrySchema, type LogEntry, type LogLevelSchema } from "@/shared/schemas";
import type { RootStore } from "./rootStore";
import type { z } from "zod";

const MAX_ENTRIES = 500;

export class LogRepo {
  constructor(private readonly root: RootStore) {}

  async list(): Promise<LogEntry[]> {
    return (await this.root.read()).logs;
  }

  async append(
    level: z.infer<typeof LogLevelSchema>,
    message: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const entry = LogEntrySchema.parse({
      level,
      message,
      at: new Date().toISOString(),
      meta,
    });
    const state = await this.root.read();
    // Ring buffer: keep only the most recent MAX_ENTRIES (§7).
    const logs = [...state.logs, entry].slice(-MAX_ENTRIES);
    await this.root.write({ ...state, logs });
  }
}
