import { useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import { EbayCredentialsSchema, type Settings } from "@/shared/schemas";
import { testConnection } from "@/background/messages";
import { storage } from "@/ui/shared/dataHooks";

interface EbayKeysPanelProps {
  settings: Settings;
  onSaved: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok" }
  | { kind: "failed"; message: string };

/** The user's own eBay keyset (docs/adr-007-ebay-adapter.md): a short
 * how-to, the two fields, and a save that immediately tests the key. */
export function EbayKeysPanel({ settings, onSaved }: EbayKeysPanelProps) {
  const s = copy.settings;
  const [clientId, setClientId] = useState(settings.ebay?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(settings.ebay?.clientSecret ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const parsed = EbayCredentialsSchema.safeParse({ clientId, clientSecret });

  async function save() {
    if (!parsed.success) return;
    setStatus({ kind: "testing" });
    try {
      await storage.settings.update({ ebay: parsed.data });
      onSaved();
      const [record] = await testConnection("ebay");
      if (record?.ok) {
        setStatus({ kind: "ok" });
      } else {
        const code = record?.errorCode ?? "APP-UNKNOWN";
        setStatus({
          kind: "failed",
          message: s.ebayFailed(code, copy.scanErrors[code].title),
        });
      }
    } catch (err) {
      setStatus({
        kind: "failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function remove() {
    await storage.settings.update({ ebay: undefined });
    setClientId("");
    setClientSecret("");
    setStatus({ kind: "idle" });
    onSaved();
  }

  return (
    <div class="options-panel">
      <span class="text-offer-title">{s.ebaySection}</span>
      <p class="text-body m0">{s.ebayIntro}</p>
      <ol class="text-body m0" style={{ paddingLeft: 20 }}>
        {s.ebaySteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a class="text-body" href={s.ebayDocsUrl} target="_blank" rel="noreferrer">
        {s.ebayDocsLink} ↗
      </a>
      <div class="fx gap3 wrap">
        <label style={{ flex: "1 1 240px" }}>
          <div class="field-label">{s.ebayClientId}</div>
          <input
            class="text-field"
            value={clientId}
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setClientId((e.target as HTMLInputElement).value)}
          />
        </label>
        <label style={{ flex: "1 1 240px" }}>
          <div class="field-label">{s.ebayClientSecret}</div>
          <input
            class="text-field"
            type="password"
            value={clientSecret}
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setClientSecret((e.target as HTMLInputElement).value)}
          />
        </label>
      </div>
      <div class="text-meta">{s.ebaySecretNote}</div>
      <div class="fx ac gap3 wrap">
        <button
          type="button"
          class="btn btn-primary"
          disabled={!parsed.success || status.kind === "testing"}
          onClick={() => void save()}
        >
          {status.kind === "testing" ? s.ebayTesting : s.ebaySave}
        </button>
        {settings.ebay && (
          <button type="button" class="btn btn-secondary" onClick={() => void remove()}>
            {s.ebayRemove}
          </button>
        )}
        {status.kind === "ok" && (
          <span class="fx ac gap2 text-meta" role="status">
            <span class="status-dot status-dot--ok" />
            {s.ebayOk}
          </span>
        )}
        {status.kind === "failed" && (
          <span class="text-meta" role="alert" style={{ color: "var(--danger)" }}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
