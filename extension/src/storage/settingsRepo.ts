import { SettingsSchema, type Settings } from "@/shared/schemas";
import type { RootStore } from "./rootStore";

export class SettingsRepo {
  constructor(private readonly root: RootStore) {}

  async get(): Promise<Settings> {
    return (await this.root.read()).settings;
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const state = await this.root.read();
    const settings = SettingsSchema.parse({ ...state.settings, ...patch });
    await this.root.write({ ...state, settings });
    return settings;
  }
}
