import { z } from "zod";

// Domain schemas — uxSmartBuy.md §3 (content model) + §12 (confirmed MVP
// defaults: 20-watch limit, 15 min default interval, 08:00 digest hour,
// 30-day offer retention, 5 min minimum interval).

export const SiteIdSchema = z.enum(["vinted", "ebay"]);

export const CHECK_INTERVAL_PRESETS_MINUTES = [5, 15, 60, 360] as const;
export const MIN_CHECK_INTERVAL_MINUTES = 5;

// Deal mode ("tryb okazji"): notify only about offers far below the
// automatically learned market price — see core/market.ts.
export const DEAL_INTERVAL_PRESETS_MINUTES = [2, 5, 15] as const;
export const DEAL_MIN_CHECK_INTERVAL_MINUTES = 2;
export const DEAL_THRESHOLD_PRESETS_PCT = [30, 40, 50] as const;
export const DEAL_DEFAULT_THRESHOLD_PCT = 50;
/** Offers below this % of the market price are "suspiciously cheap"
 * (accessories, broken items, scams): shown, never notified. */
export const DEAL_SUSPICIOUS_BELOW_PCT = 10;
/** Market price is only trusted from this many priced listings up. */
export const MARKET_MIN_SAMPLE = 10;
export const MARKET_WINDOW_DAYS = 30;
/** Listings fetched on a deal-mode watch's first check, to learn the price
 * right away instead of over days. */
export const DEAL_SEED_LISTINGS = 96;
/** Pre-filled "Pomijaj" words when deal mode is switched on. */
export const DEAL_DEFAULT_EXCLUDES = [
  "na części",
  "uszkodzony",
  "nie działa",
  "etui",
  "pasek",
  "instrukcja",
  "pudełko",
] as const;

export const DealSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** A deal is an offer priced at or below this % of the market price. */
  thresholdPct: z.number().int().min(5).max(95).default(DEAL_DEFAULT_THRESHOLD_PCT),
});
export type DealSettings = z.infer<typeof DealSettingsSchema>;

/** Market price learned from a watch's recent listings (core/market.ts). */
export const MarketStatsSchema = z.object({
  median: z.number().nonnegative(),
  p25: z.number().nonnegative(),
  p75: z.number().nonnegative(),
  sampleSize: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type MarketStats = z.infer<typeof MarketStatsSchema>;
export const WATCH_LIMIT = 20;
export const OFFER_RETENTION_DAYS = 30;
export const DEFAULT_DIGEST_HOUR = "08:00";

export const ConditionSchema = z.enum(["new", "used", "any"]);
export type Condition = z.infer<typeof ConditionSchema>;
export const EmailModeSchema = z.enum(["immediate", "daily", "off"]);
export type EmailMode = z.infer<typeof EmailModeSchema>;
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
  checkIntervalMinutes: z.number().int().min(DEAL_MIN_CHECK_INTERVAL_MINUTES),
  deal: DealSettingsSchema.optional(),
  /** Last computed market stats (deal mode only). */
  market: MarketStatsSchema.optional(),
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
).refine((w) => w.deal?.enabled || w.checkIntervalMinutes >= MIN_CHECK_INTERVAL_MINUTES, {
  message: `Sprawdzanie częściej niż co ${MIN_CHECK_INTERVAL_MINUTES} min tylko w trybie okazji.`,
  path: ["checkIntervalMinutes"],
});
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
  deal: true,
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
    checkIntervalMinutes: z
      .number()
      .int()
      .min(DEAL_MIN_CHECK_INTERVAL_MINUTES)
      .optional(),
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
  /** Deal mode only: how this offer compares to the market price. */
  dealKind: z.enum(["deal", "suspicious"]).optional(),
  /** Market median at the time it was found (deal mode only). */
  marketPrice: z.number().nonnegative().optional(),
  /** Percent below the market median, e.g. 85 for −85%. */
  discountPct: z.number().int().optional(),
  /** Cheapest shipping to Poland in `currency`, 0 = free (eBay only). */
  shippingCost: z.number().nonnegative().optional(),
  /** Auctions (eBay): `price` is the current bid. */
  auction: z
    .object({
      endsAt: z.string().datetime().optional(),
      bidCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type OfferRecord = z.infer<typeof OfferRecordSchema>;

/** One listing's price as seen by a deal-mode watch (IndexedDB "prices"). */
export const PricePointSchema = z.object({
  key: z.string(),
  watchId: z.string().uuid(),
  externalId: z.string(),
  price: z.number().nonnegative(),
  title: z.string(),
  url: z.string().url(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});
export type PricePoint = z.infer<typeof PricePointSchema>;

/**
 * Stable error codes for a failed scan — shown in the UI and copied into
 * diagnostic reports, so keep existing codes' meaning fixed. Descriptions
 * and hints live in copy.pl.ts (`scanErrors`).
 */
export const SCAN_ERROR_CODES = [
  "VNT-401",
  "VNT-403",
  "VNT-404",
  "VNT-429",
  "VNT-5XX",
  "VNT-HTTP",
  "VNT-NET",
  "VNT-TIMEOUT",
  "VNT-JSON",
  "VNT-SHAPE",
  "VNT-EMPTY",
  "EBY-KEYS",
  "EBY-AUTH",
  "EBY-401",
  "EBY-403",
  "EBY-404",
  "EBY-429",
  "EBY-5XX",
  "EBY-HTTP",
  "EBY-NET",
  "EBY-TIMEOUT",
  "EBY-JSON",
  "EBY-SHAPE",
  "EBY-EMPTY",
  "APP-UNKNOWN",
] as const;
export const ScanErrorCodeSchema = z.enum(SCAN_ERROR_CODES);
export type ScanErrorCode = z.infer<typeof ScanErrorCodeSchema>;

export const TransportSchema = z.enum(["sw", "tab"]);
export type Transport = z.infer<typeof TransportSchema>;

/** One HTTP request an adapter made during a scan. */
export const RequestTraceSchema = z.object({
  /** Request URL; for Vinted, a catalog URL whose query is the user's search. */
  url: z.string(),
  /** "sw" = fetched by the service worker, "tab" = through an open Vinted tab. */
  via: TransportSchema,
  attempt: z.number().int().positive(),
  /** HTTP status, or null when the request never got a response. */
  status: z.number().int().nullable(),
  ms: z.number().nonnegative(),
  items: z.number().int().nonnegative().optional(),
  code: ScanErrorCodeSchema.optional(),
  /** Start of the response body on failures (e.g. an anti-bot page). */
  snippet: z.string().max(500).optional(),
  note: z.string().max(200).optional(),
});
export type RequestTrace = z.infer<typeof RequestTraceSchema>;

/** One scan (a watch check, or a site connection test) for the diagnostics log. */
export const ScanRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["watch", "health"]),
  site: SiteIdSchema,
  watchId: z.string().optional(),
  watchName: z.string().optional(),
  startedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  ok: z.boolean(),
  baseline: z.boolean().default(false),
  /** Offers returned by the site, after matching, and actually new. */
  fetched: z.number().int().nonnegative().default(0),
  matched: z.number().int().nonnegative().default(0),
  inserted: z.number().int().nonnegative().default(0),
  errorCode: ScanErrorCodeSchema.optional(),
  errorMessage: z.string().max(500).optional(),
  requests: z.array(RequestTraceSchema).default([]),
});
export type ScanRecord = z.infer<typeof ScanRecordSchema>;

export const SiteHealthSchema = z.object({
  site: SiteIdSchema,
  status: AdapterHealthSchema.default("ok"),
  lastSuccessAt: z.string().datetime().optional(),
  consecutiveErrors: z.number().int().nonnegative().default(0),
  /** When the current non-ok status started, for "od 14:10" style copy. */
  since: z.string().datetime().optional(),
  lastErrorCode: ScanErrorCodeSchema.optional(),
  lastErrorMessage: z.string().max(500).optional(),
  lastErrorAt: z.string().datetime().optional(),
});
export type SiteHealth = z.infer<typeof SiteHealthSchema>;

/** The user's own eBay app keyset (Production), used for the Browse API —
 * see docs/adr-007-ebay-adapter.md. Stored only in this browser. */
export const EbayCredentialsSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
});
export type EbayCredentials = z.infer<typeof EbayCredentialsSchema>;

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
  ebay: EbayCredentialsSchema.optional(),
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
  scans: z.array(ScanRecordSchema).default([]),
});
export type StorageRoot = z.infer<typeof StorageRootSchema>;
