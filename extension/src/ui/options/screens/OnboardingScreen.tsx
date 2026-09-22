import { useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import type { Settings, Watch } from "@/shared/schemas";
import { requestEmailVerification } from "@/shared/backendClient";
import { BrandMark } from "@/ui/shared/BrandMark";
import { storage } from "@/ui/shared/dataHooks";
import { NewWatchForm } from "@/ui/shared/NewWatchForm";

interface OnboardingScreenProps {
  settings: Settings;
  onComplete: (watch?: Watch) => void;
}

/** uxSmartBuy.md §4 F1 — first-run, options page. */
export function OnboardingScreen({ settings, onComplete }: OnboardingScreenProps) {
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "saving" | "sent" | "error">(
    "idle",
  );
  const [showForm, setShowForm] = useState(false);

  async function saveEmail() {
    if (!email) return;
    setEmailStatus("saving");
    try {
      await storage.settings.update({ email });
      await requestEmailVerification(email);
      setEmailStatus("sent");
    } catch {
      setEmailStatus("error");
    }
  }

  if (showForm) {
    return (
      <div class="col" style={{ maxWidth: 480, margin: "40px auto" }}>
        <NewWatchForm
          settings={settings}
          onCancel={() => setShowForm(false)}
          onDone={async (watch) => {
            await storage.settings.update({
              onboardingCompletedAt: new Date().toISOString(),
              notificationsPermissionAskedAt: new Date().toISOString(),
            });
            onComplete(watch);
          }}
        />
      </div>
    );
  }

  return (
    <div
      class="col gap4"
      style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}
    >
      <div class="fx ac gap2">
        <BrandMark size="large" />
        <span class="brand-name">Thunder Bait</span>
      </div>
      <p class="m0" style={{ font: "600 20px/28px var(--font-family)" }}>
        {copy.onboarding.pitch}
      </p>
      <div>
        <div class="field-label">{copy.onboarding.emailLabel}</div>
        <div class="fx gap2">
          <input
            class="text-field"
            style={{ flex: 1 }}
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            placeholder={copy.onboarding.emailPlaceholder}
          />
          <button
            type="button"
            class="btn btn-secondary"
            disabled={!email || emailStatus === "saving"}
            onClick={() => void saveEmail()}
          >
            {copy.onboarding.save}
          </button>
        </div>
        {emailStatus === "sent" && (
          <div class="text-meta" style={{ marginTop: 6, color: "var(--action)" }}>
            {copy.form.emailUnverified}
          </div>
        )}
      </div>
      <div class="fx ac gap4">
        <button type="button" class="btn btn-primary" onClick={() => setShowForm(true)}>
          {copy.onboarding.addFirstWatch}
        </button>
        <button
          type="button"
          class="text-body"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-muted)",
          }}
          onClick={() =>
            void storage.settings
              .update({ onboardingCompletedAt: new Date().toISOString() })
              .then(() => onComplete())
          }
        >
          {copy.onboarding.skip}
        </button>
      </div>
      <p class="text-meta m0">{copy.onboarding.permissionNote}</p>
    </div>
  );
}
