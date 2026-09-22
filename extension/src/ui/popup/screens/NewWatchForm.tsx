import { useState } from "preact/hooks";
import { BrandMark } from "@/ui/shared/BrandMark";
import { ChipInput } from "@/ui/shared/ChipInput";
import { Field } from "@/ui/shared/Field";
import { SegmentedControl } from "@/ui/shared/SegmentedControl";
import { Checkbox } from "@/ui/shared/Checkbox";
import { Disclosure } from "@/ui/shared/Disclosure";
import { copy } from "@/shared/copy.pl";
import {
  CHECK_INTERVAL_PRESETS_MINUTES,
  type Condition,
  type EmailMode,
  type Settings,
  type Watch,
} from "@/shared/schemas";
import type { SiteId } from "@/adapters/types";
import { createWatch, updateWatch } from "@/background/messages";

const ALL_SITES: SiteId[] = ["olx", "vinted", "allegro"];

interface NewWatchFormProps {
  watch?: Watch | undefined;
  settings: Settings;
  onDone: (watch: Watch) => void;
  onCancel: () => void;
}

export function NewWatchForm({ watch, settings, onDone, onCancel }: NewWatchFormProps) {
  const isEdit = !!watch;
  const [name, setName] = useState(watch?.name ?? "");
  const [variants, setVariants] = useState<string[]>(
    (watch?.keywords ?? []).filter((k) => k !== watch?.name),
  );
  const [priceMax, setPriceMax] = useState(watch?.priceMax?.toString() ?? "");
  const [sites, setSites] = useState<SiteId[]>(watch?.sites ?? ALL_SITES);
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && sites.length > 0 && !submitting;

  function toggleSite(site: SiteId) {
    setSites((prev) =>
      prev.includes(site)
        ? prev.length > 1
          ? prev.filter((s) => s !== site)
          : prev
        : [...prev, site],
    );
  }

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
      name: name.trim(),
      keywords,
      excludeKeywords,
      sites,
      priceMin: parsedPriceMin,
      priceMax: parsedPriceMax,
      location: locationCity
        ? {
            city: locationCity,
            radiusKm: locationRadius ? Number(locationRadius) : undefined,
          }
        : undefined,
      condition,
      size: size || undefined,
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
    <form class="col popup-form" onSubmit={handleSubmit}>
      <div class="fx ac gap2 popup-form-header">
        <button
          type="button"
          class="icon-btn"
          style={{ background: "none" }}
          aria-label="Wstecz"
          onClick={onCancel}
        >
          ←
        </button>
        <BrandMark />
        <span class="brand-name">
          {isEdit ? copy.form.titleEdit : copy.form.titleNew}
        </span>
      </div>

      <div class="col gap3 popup-form-body">
        <Field label={copy.form.nameLabel}>
          <input
            class="text-field text-field--active"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="np. Leica M6"
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

        <div class="fx gap3">
          <div style={{ flex: 1 }}>
            <Field label={copy.form.priceMaxLabel}>
              <div class="fx ac jb text-field">
                <input
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
                <span class="text-meta">{copy.form.currency}</span>
              </div>
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={copy.form.sitesLabel}>
              <div class="fx gap2">
                {ALL_SITES.map((site) => (
                  <button
                    key={site}
                    type="button"
                    class={`site-toggle ${sites.includes(site) ? "site-toggle--active" : ""}`}
                    onClick={() => toggleSite(site)}
                  >
                    {copy.form.siteShort[site]}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <Field label={copy.form.intervalLabel}>
          <SegmentedControl
            label={copy.form.intervalLabel}
            value={interval}
            onChange={setInterval_}
            options={CHECK_INTERVAL_PRESETS_MINUTES.map((m) => ({
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
          <Field label={copy.form.priceMinLabel}>
            <input
              class="text-field"
              value={priceMin}
              onInput={(e) => setPriceMin((e.target as HTMLInputElement).value)}
              inputMode="numeric"
            />
          </Field>
          <Field label={copy.form.excludeKeywordsLabel}>
            <ChipInput
              value={excludeKeywords}
              onChange={setExcludeKeywords}
              addLabel={copy.form.addVariant}
              max={20}
            />
          </Field>
          <div class="fx gap3">
            <div style={{ flex: 1 }}>
              <Field label={copy.form.locationLabel}>
                <input
                  class="text-field"
                  value={locationCity}
                  onInput={(e) => setLocationCity((e.target as HTMLInputElement).value)}
                  placeholder="Miasto"
                />
              </Field>
            </div>
            <div style={{ width: 90 }}>
              <Field label="+ km">
                <input
                  class="text-field"
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
          <Field label={copy.form.sizeLabel}>
            <input
              class="text-field"
              value={size}
              onInput={(e) => setSize((e.target as HTMLInputElement).value)}
            />
          </Field>
        </Disclosure>

        {error && (
          <div class="text-meta" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}
      </div>

      <div class="popup-form-footer">
        <button type="submit" class="btn btn-primary btn-block" disabled={!canSubmit}>
          {isEdit ? copy.form.submitEdit : copy.form.submitNew}
        </button>
      </div>
    </form>
  );
}
