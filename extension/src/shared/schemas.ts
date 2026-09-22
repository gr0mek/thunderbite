import { z } from "zod";

// Domain schemas — uxSmartBuy.md §3 (content model) + §12 (confirmed MVP
// defaults: 20-watch limit, 15 min default interval, 08:00 digest hour,
// 30-day offer retention, 5 min minimum interval).

export const SiteIdSchema = z.enum(["olx", "vinted", "allegro"]);

export const CHECK_INTERVAL_PRESETS_MINUTES = [5, 15, 60, 360] as const;
export const MIN_CHECK_INTERVAL_MINUTES = 5;
export const WATCH_LIMIT = 20;
export const OFFER_RETENTION_DAYS = 30;
export const DEFAULT_DIGEST_HOUR = "08:00";

export const ConditionSchema = z.enum(["new", "used", "any"]);
export const EmailModeSchema = z.enum(["immediate", "daily", "off"]);
export const AdapterHealthSchema = z.enum(["ok", "degraded", "broken"]);
export const OfferStateSchema = z.enum(["new", "seen", "hidden"]);

export const LocationSchema = z.object({
  city: z.string().min(1),
  radiusKm: z.number().positive().optional(),
});

/**
 * A "Watch" (Obserwacja) as persisted in chrome.storage.local.
 * uxSmartBuy.md §3.1's `status` (Aktywna/Wstrzymana/Problem) is NOT stored
 * here — "Wstrzymana" is the `paused` flag and "Problem" is derived at read
 * time from the health of the watch's selected sites (site health is
 * shared across watches, see SiteHealthSchema).
 */
const WatchObjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(60),
  keywords: z.array(z.string().min(1)).min(1).max(10),
  excludeKeywords: z.array(z.string().min(1)).max(20).default([]),
  sites: z.array(SiteIdSchema).min(1),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  location: LocationSchema.optional(),
  condition: ConditionSchema.default("any"),
  size: z.string().max(40).optional(),
  checkIntervalMinutes: z.number().int().min(MIN_CHECK_INTERVAL_MINUTES),
  notifyBrowser: z.boolean().default(true),
  notifyEmail: EmailModeSchema.default("immediate"),
  paused: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Set once the silent first check (baseline) has run; see uxSmartBuy §4 F2. */
  baselineCompletedAt: z.string().datetime().optional(),
  lastCheckedAt: z.string().datetime().optional(),
});

export const WatchSchema = WatchObjectSchema.refine(
  (w) => w.priceMin === undefined || w.priceMax === undefined || w.priceMin <= w.priceMax,
  { message: "Cena min. musi być niższa niż maks.", path: ["priceMin"] },
);
export type Watch = z.infer<typeof WatchSchema>;

/** Input for creating a watch — only name is truly required (uxSmartBuy §3.1). */
export const NewWatchInputSchema = WatchObjectSchema.pick({
  name: true,
  excludeKeywords: true,
  priceMin: true,
  priceMax: true,
  location: true,
  condition: true,
  size: true,
  notifyBrowser: true,
  notifyEmail: true,
})
  .partial({
    excludeKeywords: true,
    condition: true,
    notifyBrowser: true,
    notifyEmail: true,
  })
  .extend({
    keywords: z.array(z.string().min(1)).max(10).optional(),
    sites: z.array(SiteIdSchema).optional(),
    checkIntervalMinutes: z.number().int().min(MIN_CHECK_INTERVAL_MINUTES).optional(),
  });
export type NewWatchInput = z.infer<typeof NewWatchInputSchema>;

/**
 * A normalized, matched offer as persisted in IndexedDB. `key` (`${site}:
 * ${externalId}`) is the dedup primary key — see adapters/types.ts#offerKey.
 */
export const OfferRecordSchema = z.object({
  key: z.string(),
  watchId: z.string().uuid(),
  site: SiteIdSchema,
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  price: z.number().nullable(),
  currency: z.string(),
  imageUrl: z.string().url().optional(),
  location: z.string().optional(),
  postedAt: z.string().datetime().optional(),
  state: OfferStateSchema.default("new"),
  foundAt: z.string().datetime(),
  /** True if found during the silent baseline check — never notified, shown
   * under "Już dostępne" instead of counted in the new-offers badge. */
  isBaseline: z.boolean().default(false),
});
export type OfferRecord = z.infer<typeof OfferRecordSchema>;

export const SiteHealthSchema = z.object({
  site: SiteIdSchema,
  status: AdapterHealthSchema.default("ok"),
  lastSuccessAt: z.string().datetime().optional(),
  consecutiveErrors: z.number().int().nonnegative().default(0),
  /** When the current non-ok status started, for "od 14:10" style copy. */
  since: z.string().datetime().optional(),
});
export type SiteHealth = z.infer<typeof SiteHealthSchema>;

export const SettingsSchema = z.object({
  email: z.string().email().optional(),
  emailVerified: z.boolean().default(false),
  defaultCheckIntervalMinutes: z
    .number()
    .int()
    .min(MIN_CHECK_INTERVAL_MINUTES)
    .default(15),
  defaultEmailMode: EmailModeSchema.default("immediate"),
  digestHour: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default(DEFAULT_DIGEST_HOUR),
  watchLimit: z.number().int().positive().default(WATCH_LIMIT),
  offerRetentionDays: z.number().int().positive().default(OFFER_RETENTION_DAYS),
  notificationsPermissionAskedAt: z.string().datetime().optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export const LogEntrySchema = z.object({
  level: LogLevelSchema,
  message: z.string(),
  at: z.string().datetime(),
  meta: z.record(z.unknown()).optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

/** Root shape of chrome.storage.local, versioned for migrations (storage/migrations.ts). */
export const StorageRootSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  watches: z.array(WatchSchema).default([]),
  settings: SettingsSchema.default(SettingsSchema.parse({})),
  siteHealth: z.array(SiteHealthSchema).default([]),
  logs: z.array(LogEntrySchema).default([]),
});
export type StorageRoot = z.infer<typeof StorageRootSchema>;
