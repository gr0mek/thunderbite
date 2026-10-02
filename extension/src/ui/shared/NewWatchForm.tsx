import { useState } from "preact/hooks";
import { BrandMark } from "@/ui/shared/BrandMark";
import { ChipInput } from "@/ui/shared/ChipInput";
import { Field } from "@/ui/shared/Field";
import { SegmentedControl } from "@/ui/shared/SegmentedControl";
import { Checkbox } from "@/ui/shared/Checkbox";
import { Disclosure } from "@/ui/shared/Disclosure";
import { copy } from "@/shared/copy.pl";
import { Toggle } from "@/ui/shared/Toggle";
import { formatPrice } from "@/shared/format";
import { ALL_SITES, SITE_CURRENCY } from "@/shared/sites";
import type { SiteId } from "@/adapters/types";
import { dealThreshold } from "@/core/market";
import {
  CHECK_INTERVAL_PRESETS_MINUTES,
  DEAL_DEFAULT_EXCLUDES,
  DEAL_DEFAULT_THRESHOLD_PCT,
  DEAL_INTERVAL_PRESETS_MINUTES,
  DEAL_THRESHOLD_PRESETS_PCT,
  MIN_CHECK_INTERVAL_MINUTES,
  type Condition,
  type EmailMode,
  type Settings,
  type Watch,
} from "@/shared/schemas";
import { createWatch, updateWatch } from "@/background/messages";

interface NewWatchFormProps {
  watch?: Watch | undefined;
  /** Pre-fill for create-mode only, from the F3 quick-add banner. */
  initialQuery?:
    | { name: string; priceMax?: number | undefined; site?: SiteId | undefined }
    | undefined;
  settings: Settings;
  onDone: (watch: Watch) => void;
  onCancel: () => void;
}

export function NewWatchForm({
  watch,
  initialQuery,
  settings,
  onDone,
  onCancel,
}: NewWatchFormProps) {
  const isEdit = !!watch;
  // One site per watch: its price filters and market value are in that
  // site's currency (zł on Vinted, $ on eBay), so it can't change later.
  const [site, setSite] = useState<SiteId>(
    watch?.sites[0] ?? initialQuery?.site ?? "vinted",
  );
  const currency = SITE_CURRENCY[site];
  const price = (n: number) => formatPrice(n, currency);
  const [name, setName] = useState(watch?.name ?? initialQuery?.name ?? "");
  const [variants, setVariants] = useState<string[]>(
    (watch?.keywords ?? []).filter((k) => k !== watch?.name),
  );
  const [priceMax, setPriceMax] = useState(
    (watch?.priceMax ?? initialQuery?.priceMax)?.toString() ?? "",
  );
  const [interval, setInterval_] = useState(
    watch?.checkIntervalMinutes ?? settings.defaultCheckIntervalMinutes,
  );
  const [notifyBrowser, setNotifyBrowser] = useState(watch?.notifyBrowser ?? true);
  const [notifyEmail, setNotifyEmail] = useState<EmailMode>(
    watch?.notifyEmail ?? settings.defaultEmailMode,
  );

  const hasAdvancedValue = !!(
    watch?.priceMin ||
    watch?.excludeKeywords.length ||
    watch?.location ||
    (watch && watch.condition !== "any") ||
    watch?.size
  );
  const [priceMin, setPriceMin] = useState(watch?.priceMin?.toString() ?? "");
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(
    watch?.excludeKeywords ?? [],
  );
  const [locationCity, setLocationCity] = useState(watch?.location?.city ?? "");
  const [locationRadius, setLocationRadius] = useState(
    watch?.location?.radiusKm?.toString() ?? "",
  );
  const [condition, setCondition] = useState<Condition>(watch?.condition ?? "any");
  const [size, setSize] = useState(watch?.size ?? "");
  const [dealEnabled, setDealEnabled] = useState(watch?.deal?.enabled ?? false);
  const [thresholdPct, setThresholdPct] = useState(
    watch?.deal?.thresholdPct ?? DEAL_DEFAULT_THRESHOLD_PCT,
  );
  const [submitting, setSubmitting] = useState(false);

  function toggleDeal(next: boolean) {
    setDealEnabled(next);
    if (next) {
      // Fast checks are what make deal mode useful; pre-fill the usual junk.
      if (interval > DEAL_INTERVAL_PRESETS_MINUTES[0])
        setInterval_(DEAL_INTERVAL_PRESETS_MINUTES[0]);
      if (excludeKeywords.length === 0) setExcludeKeywords([...DEAL_DEFAULT_EXCLUDES]);
    } else if (interval < MIN_CHECK_INTERVAL_MINUTES) {
      setInterval_(settings.defaultCheckIntervalMinutes);
    }
  }

  const intervalPresets: readonly number[] = dealEnabled
    ? DEAL_INTERVAL_PRESETS_MINUTES
    : CHECK_INTERVAL_PRESETS_MINUTES;
  const market = watch?.deal?.enabled ? watch.market : undefined;
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError(copy.form.validation.nameRequired);
      return;
    }
    const parsedPriceMin = priceMin ? Number(priceMin) : undefined;
    const parsedPriceMax = priceMax ? Number(priceMax) : undefined;
    if (
      parsedPriceMin !== undefined &&
      parsedPriceMax !== undefined &&
      parsedPriceMin > parsedPriceMax
    ) {
      setError(copy.form.validation.priceOrder);
      return;
    }
    setError(null);
    setSubmitting(true);

    const keywords = [name.trim(), ...variants.filter((v) => v !== name.trim())];
    const payload = {
      ...(!isEdit && { sites: [site] }),
      name: name.trim(),
      keywords,
      excludeKeywords,
      priceMin: dealEnabled ? undefined : parsedPriceMin,
      priceMax: dealEnabled ? undefined : parsedPriceMax,
      deal: { enabled: dealEnabled, thresholdPct },
      location: locationCity
        ? {
            city: locationCity,
            radiusKm: locationRadius ? Number(locationRadius) : undefined,
          }
        : undefined,
      condition,
      size: site === "vinted" && size ? size : undefined,
      checkIntervalMinutes: interval,
      notifyBrowser,
      notifyEmail,
    };

    try {
      const result = isEdit
        ? await updateWatch(watch!.id, payload)
        : await createWatch(payload);
      onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form class="col form-panel" onSubmit={handleSubmit}>
      <div class="fx ac gap2 form-panel-header">
        <button
          type="button"
          class="icon-btn"
          style={{ background: "none" }}
          aria-label={copy.common.back}
          onClick={onCancel}
        >
          ←
        </button>
        <BrandMark />
        <span class="brand-name">
          {isEdit ? copy.form.titleEdit : copy.form.titleNew}
        </span>
      </div>

      <div class="col gap3 form-panel-body">
        <Field label={copy.form.siteLabel}>
          {isEdit ? (
            <div class="text-body" title={copy.form.siteLocked}>
              {copy.siteNames[site]}
            </div>
          ) : (
            <SegmentedControl
              label={copy.form.siteLabel}
              value={site}
              onChange={setSite}
              options={ALL_SITES.map((s) => ({ value: s, label: copy.siteNames[s] }))}
            />
          )}
          {site === "ebay" && (
            <div class="text-meta" style={{ marginTop: 6 }}>
              {settings.ebay ? (
                copy.form.ebayHint
              ) : (
                <>
                  {copy.form.ebayNoKeys}{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      void chrome.tabs.create({
                        url: chrome.runtime.getURL("src/ui/options/index.html#/settings"),
                      });
                    }}
                  >
                    {copy.form.ebayAddKeys}
                  </a>
                </>
              )}
            </div>
          )}
        </Field>

        <Field label={copy.form.nameLabel}>
          <input
            class="text-field text-field--active"
            aria-label={copy.form.nameLabel}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder={copy.form.namePlaceholder}
            autoFocus
          />
          <div class="text-meta" style={{ marginTop: 8, marginBottom: 6 }}>
            {copy.form.nameVariantsLabel}
          </div>
          <ChipInput
            value={variants}
            onChange={setVariants}
            addLabel={copy.form.addVariant}
          />
        </Field>

        <div class={`deal-card ${dealEnabled ? "deal-card--on" : ""}`}>
          <div class="fx ac jb gap2">
            <div>
              <div class="field-label" style={{ margin: 0 }}>
                {copy.deal.modeTitle}
              </div>
              <div class="text-meta">{copy.deal.modeDescription}</div>
            </div>
            <Toggle
              checked={dealEnabled}
              onChange={toggleDeal}
              label={copy.deal.modeTitle}
            />
          </div>
          {dealEnabled && (
            <>
              <Field label={copy.deal.marketValueLabel}>
                <div class="text-meta">
                  {market
                    ? copy.deal.marketAuto(
                        price(market.median),
                        market.sampleSize,
                        price(market.p25),
                        price(market.p75),
                      )
                    : copy.deal.marketLearning}
                </div>
              </Field>
              <Field label={copy.deal.thresholdLabel}>
                <SegmentedControl
                  label={copy.deal.thresholdLabel}
                  value={thresholdPct}
                  onChange={setThresholdPct}
                  options={DEAL_THRESHOLD_PRESETS_PCT.map((pct) => ({
                    value: pct,
                    label: copy.deal.thresholdPreset(pct),
                  }))}
                />
                <div class="deal-result">
                  {market
                    ? copy.deal.thresholdResult(
                        price(dealThreshold(market.median, thresholdPct)),
                      )
                    : copy.deal.thresholdResultPct(thresholdPct)}
                </div>
              </Field>
              {site === "ebay" && (
                <div class="text-meta">{copy.deal.auctionsIgnored}</div>
              )}
              <Field label={copy.deal.excludesLabel}>
                <ChipInput
                  value={excludeKeywords}
                  onChange={setExcludeKeywords}
                  addLabel={copy.form.addVariant}
                  max={20}
                />
              </Field>
            </>
          )}
        </div>

        {!dealEnabled && (
          <Field label={copy.form.priceMaxLabel}>
            <div class="fx ac jb text-field">
              <input
                aria-label={copy.form.priceMaxLabel}
                value={priceMax}
                onInput={(e) => setPriceMax((e.target as HTMLInputElement).value)}
                inputMode="numeric"
                style={{
                  border: "none",
                  background: "none",
                  width: "100%",
                  color: "inherit",
                  font: "inherit",
                }}
              />
              <span class="text-meta">{copy.price.symbol(currency)}</span>
            </div>
          </Field>
        )}

        <Field label={copy.form.intervalLabel}>
          <SegmentedControl
            label={copy.form.intervalLabel}
            value={interval}
            onChange={setInterval_}
            options={intervalPresets.map((m) => ({
              value: m,
              label: copy.form.intervalPreset(m),
            }))}
          />
        </Field>

        <Field label={copy.form.notifyLabel}>
          <div class="col gap2">
            <Checkbox checked={notifyBrowser} onChange={setNotifyBrowser}>
              {copy.form.notifyBrowser}
            </Checkbox>
            <div class="fx ac gap2">
              <span class="text-body">{copy.form.emailLabel}</span>
              <select
                class="select-field"
                style={{ width: "auto" }}
                aria-label={copy.form.emailLabel}
                value={notifyEmail}
                disabled={!settings.emailVerified}
                onChange={(e) =>
                  setNotifyEmail((e.target as HTMLSelectElement).value as EmailMode)
                }
              >
                <option value="immediate">{copy.form.emailModeImmediate}</option>
                <option value="daily">{copy.form.emailModeDaily}</option>
                <option value="off">{copy.form.emailModeOff}</option>
              </select>
            </div>
            {!settings.emailVerified && (
              <div class="text-meta">
                {copy.form.emailUnverified}{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    chrome.runtime.openOptionsPage();
                  }}
                >
                  {copy.form.addEmail}
                </a>
              </div>
            )}
          </div>
        </Field>

        <Disclosure
          title={copy.form.moreFilters}
          summary={copy.form.moreFiltersSummary}
          defaultOpen={hasAdvancedValue}
        >
          {!dealEnabled && (
            <Field label={copy.form.priceMinLabel}>
              <input
                class="text-field"
                aria-label={copy.form.priceMinLabel}
                value={priceMin}
                onInput={(e) => setPriceMin((e.target as HTMLInputElement).value)}
                inputMode="numeric"
              />
            </Field>
          )}
          {!dealEnabled && (
            <Field label={copy.form.excludeKeywordsLabel}>
              <ChipInput
                value={excludeKeywords}
                onChange={setExcludeKeywords}
                addLabel={copy.form.addVariant}
                max={20}
              />
            </Field>
          )}
          <div class="fx gap3">
            <div style={{ flex: 1 }}>
              <Field label={copy.form.locationLabel}>
                <input
                  class="text-field"
                  aria-label={copy.form.locationLabel}
                  value={locationCity}
                  onInput={(e) => setLocationCity((e.target as HTMLInputElement).value)}
                  placeholder={copy.form.cityPlaceholder}
                />
              </Field>
            </div>
            <div style={{ width: 90 }}>
              <Field label="+ km">
                <input
                  class="text-field"
                  aria-label={copy.form.radiusLabel}
                  value={locationRadius}
                  onInput={(e) => setLocationRadius((e.target as HTMLInputElement).value)}
                  inputMode="numeric"
                />
              </Field>
            </div>
          </div>
          <Field label={copy.form.conditionLabel}>
            <select
              class="select-field"
              aria-label={copy.form.conditionLabel}
              value={condition}
              onChange={(e) =>
                setCondition((e.target as HTMLSelectElement).value as Condition)
              }
            >
              <option value="any">{copy.form.conditionAny}</option>
              <option value="new">{copy.form.conditionNew}</option>
              <option value="used">{copy.form.conditionUsed}</option>
            </select>
          </Field>
          {site === "vinted" && (
            <Field label={copy.form.sizeLabel}>
              <input
                class="text-field"
                aria-label={copy.form.sizeLabel}
                value={size}
                onInput={(e) => setSize((e.target as HTMLInputElement).value)}
              />
            </Field>
          )}
        </Disclosure>

        {error && (
          <div class="text-meta" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}
      </div>

      <div class="form-panel-footer">
        <button type="submit" class="btn btn-primary btn-block" disabled={!canSubmit}>
          {isEdit ? copy.form.submitEdit : copy.form.submitNew}
        </button>
      </div>
    </form>
  );
}
