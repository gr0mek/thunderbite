import { useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import {
  CHECK_INTERVAL_PRESETS_MINUTES,
  SettingsSchema,
  type EmailMode,
  type Settings,
} from "@/shared/schemas";
import { formatRelativeTime } from "@/shared/format";
import { requestEmailVerification } from "@/shared/backendClient";
import { storage, useSiteHealth } from "@/ui/shared/dataHooks";
import { Modal } from "@/ui/shared/Modal";
import { EbayKeysPanel } from "../components/EbayKeysPanel";

interface SettingsScreenProps {
  settings: Settings;
  onSettingsChange: () => void;
  onAllDataDeleted: () => void;
}

const DIGEST_HOURS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);

export function SettingsScreen({
  settings,
  onSettingsChange,
  onAllDataDeleted,
}: SettingsScreenProps) {
  const siteHealth = useSiteHealth();
  const [email, setEmail] = useState(settings.email ?? "");
  const [sendingTest, setSendingTest] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function update(patch: Partial<Settings>) {
    await storage.settings.update(patch);
    onSettingsChange();
  }

  async function sendTestEmail() {
    if (!settings.email) return;
    setSendingTest(true);
    try {
      await requestEmailVerification(settings.email);
    } finally {
      setSendingTest(false);
    }
  }

  async function deleteAllData() {
    setDeleting(true);
    try {
      const all = await storage.watches.list();
      for (const w of all) await storage.offers.deleteByWatch(w.id);
      await storage.offers.deleteAll();
      await storage.prices.deleteAll();
      await storage.root.write({
        schemaVersion: 1,
        watches: [],
        settings: SettingsSchema.parse({}),
        siteHealth: [],
        logs: [],
        scans: [],
      });
      onAllDataDeleted();
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div class="col gap4">
      <span class="text-title">{copy.settings.title}</span>

      <div class="options-panel">
        <span class="text-offer-title">{copy.settings.emailSection}</span>
        <div class="fx ac gap3 wrap">
          <input
            class="text-field"
            style={{ minWidth: 240, width: "auto", flex: "1 1 240px" }}
            aria-label={copy.settings.emailSection}
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            onBlur={() =>
              email !== settings.email && void update({ email, emailVerified: false })
            }
          />
          <span class="fx ac gap2 text-meta">
            <span
              class={`status-dot status-dot--${settings.emailVerified ? "ok" : "degraded"}`}
            />
            {settings.emailVerified ? copy.settings.verified : copy.settings.unverified}
          </span>
          <button
            type="button"
            class="btn btn-secondary"
            disabled={!settings.email || sendingTest}
            onClick={() => void sendTestEmail()}
          >
            {copy.settings.sendTestEmail}
          </button>
        </div>
      </div>

      <div class="options-panel">
        <span class="text-offer-title">{copy.settings.defaultsSection}</span>
        <div class="fx gap3 wrap">
          <div>
            <div class="field-label">{copy.form.intervalLabel}</div>
            <select
              class="select-field"
              aria-label={copy.form.intervalLabel}
              value={settings.defaultCheckIntervalMinutes}
              onChange={(e) =>
                void update({
                  defaultCheckIntervalMinutes: Number(
                    (e.target as HTMLSelectElement).value,
                  ),
                })
              }
            >
              {CHECK_INTERVAL_PRESETS_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {copy.form.intervalPreset(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div class="field-label">{copy.settings.emailSection}</div>
            <select
              class="select-field"
              aria-label={copy.settings.emailSection}
              value={settings.defaultEmailMode}
              onChange={(e) =>
                void update({
                  defaultEmailMode: (e.target as HTMLSelectElement).value as EmailMode,
                })
              }
            >
              <option value="immediate">{copy.form.emailModeImmediate}</option>
              <option value="daily">{copy.form.emailModeDaily}</option>
              <option value="off">{copy.form.emailModeOff}</option>
            </select>
          </div>
          <div>
            <div class="field-label">{copy.settings.digestHourLabel}</div>
            <select
              class="select-field"
              aria-label={copy.settings.digestHourLabel}
              value={settings.digestHour}
              onChange={(e) =>
                void update({ digestHour: (e.target as HTMLSelectElement).value })
              }
            >
              {DIGEST_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div class="options-panel">
        <span class="text-offer-title">{copy.settings.servicesSection}</span>
        <div class="col gap2">
          {siteHealth.map((h) => (
            <div key={h.site} class="fx ac gap2 text-body">
              <span
                class={`status-dot status-dot--${h.site === "ebay" && !settings.ebay ? "off" : h.status === "ok" ? "ok" : "degraded"}`}
              />
              <span style={{ minWidth: 64, color: "var(--ink)" }}>
                {copy.siteNames[h.site]}
              </span>
              <span class="text-meta">
                {h.site === "ebay" && !settings.ebay
                  ? copy.settings.ebayNotConfigured
                  : h.status === "ok"
                    ? h.lastSuccessAt
                      ? `${copy.settings.serviceWorking} · ${copy.settings.lastSuccessfulCheck(formatRelativeTime(h.lastSuccessAt))} · ${copy.settings.errorCount(0)}`
                      : copy.settings.serviceWorking
                    : `${copy.settings.problemSince(h.since ? formatRelativeTime(h.since) : "—")} · ${copy.settings.errorCount(h.consecutiveErrors)}${h.lastErrorCode ? ` · ${copy.settings.lastErrorCode(h.lastErrorCode)}` : ""}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <EbayKeysPanel settings={settings} onSaved={onSettingsChange} />

      <div class="options-panel fx ac jb" style={{ flexDirection: "row" }}>
        <div>
          <div class="text-offer-title">{copy.settings.dataSection}</div>
          <div class="text-meta">{copy.settings.dataDescription}</div>
        </div>
        <button
          type="button"
          class="btn btn-danger"
          onClick={() => setConfirmingDelete(true)}
        >
          {copy.settings.deleteAllData}
        </button>
      </div>

      {confirmingDelete && (
        <Modal
          title={copy.settings.deleteAllDataConfirmTitle}
          onClose={() => setConfirmingDelete(false)}
        >
          <p class="text-body">{copy.settings.deleteAllDataConfirmBody}</p>
          <div class="fx jend gap2" style={{ marginTop: 16 }}>
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              {copy.settings.cancel}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              disabled={deleting}
              onClick={() => void deleteAllData()}
            >
              {copy.settings.deleteAllDataConfirmCta}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
