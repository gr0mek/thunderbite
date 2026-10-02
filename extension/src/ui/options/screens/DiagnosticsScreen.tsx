import { Fragment } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import { formatRelativeTime } from "@/shared/format";
import type { ScanErrorCode, ScanRecord, SiteHealth } from "@/shared/schemas";
import type { DiagnosticsEnvironment } from "@/background/diagnostics";
import { getDiagnosticsEnvironment, testConnection } from "@/background/messages";
import { buildDiagnosticsReport } from "@/core/diagnosticsReport";
import { storage, useLogEntries, useScanLog } from "@/ui/shared/dataHooks";
import { Disclosure } from "@/ui/shared/Disclosure";

const timeFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function CodeBadge({ code }: { code: ScanErrorCode }) {
  return (
    <span class="code-badge" title={copy.scanErrors[code].title}>
      {code}
    </span>
  );
}

function ErrorExplanation({ code }: { code: ScanErrorCode }) {
  return (
    <div class="col gap1">
      <span class="fx ac gap2 text-body">
        <CodeBadge code={code} />
        <strong>{copy.scanErrors[code].title}</strong>
      </span>
      <span class="text-meta">{copy.scanErrors[code].hint}</span>
    </div>
  );
}

function HealthRow({ h }: { h: SiteHealth }) {
  return (
    <div class="col gap2">
      <div class="fx ac gap2 text-body">
        <span class={`status-dot status-dot--${h.status === "ok" ? "ok" : "degraded"}`} />
        <strong>{copy.siteNames[h.site]}</strong>
        <span class="text-meta">
          {h.status === "ok" ? copy.diagnostics.statusOk : copy.diagnostics.statusProblem}
          {" · "}
          {h.lastSuccessAt
            ? copy.diagnostics.lastSuccess(formatRelativeTime(h.lastSuccessAt))
            : copy.diagnostics.neverSucceeded}
          {h.status !== "ok" && ` · ${copy.settings.errorCount(h.consecutiveErrors)}`}
          {h.status === "ok" &&
            h.lastErrorAt &&
            ` · ${copy.diagnostics.lastError(formatRelativeTime(h.lastErrorAt), h.lastErrorCode)}`}
        </span>
      </div>
      {h.status !== "ok" && h.lastErrorCode && (
        <ErrorExplanation code={h.lastErrorCode} />
      )}
      {h.status !== "ok" && h.lastErrorMessage && (
        <code class="diag-pre">{h.lastErrorMessage}</code>
      )}
    </div>
  );
}

function EnvironmentPanel({ env }: { env: DiagnosticsEnvironment | null }) {
  const d = copy.diagnostics;
  if (!env) return null;
  const rows: [string, string][] = [
    [d.envVersion, env.extensionVersion],
    [d.envSessionCookie, env.hasSessionCookie ? d.yes : d.no],
    [d.envCookies, env.vintedCookieNames.join(", ") || d.none],
    [d.envTabs, String(env.vintedTabs)],
    [d.envHeaderRule, env.headerRuleActive ? d.active : d.inactive],
    [d.envEbayKeys, env.ebayKeysConfigured ? d.yes : d.no],
  ];
  return (
    <div class="options-panel">
      <span class="text-offer-title">{d.environmentSection}</span>
      <dl class="diag-kv">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt class="text-meta">{k}</dt>
            <dd class="text-body">{v}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function ScanDetails({ scan }: { scan: ScanRecord }) {
  const d = copy.diagnostics;
  return (
    <div class="col gap2 diag-details">
      {scan.errorCode && <ErrorExplanation code={scan.errorCode} />}
      {scan.errorMessage && (
        <div class="col gap1">
          <span class="text-meta">{d.errorMessage}</span>
          <code class="diag-pre">{scan.errorMessage}</code>
        </div>
      )}
      {scan.requests.length > 0 && (
        <div class="col gap1">
          <span class="text-meta">{d.requests}</span>
          {scan.requests.map((r, i) => (
            <div key={i} class="col gap1 diag-request">
              <span class="fx ac gap2 wrap text-meta">
                <span>{d.reqVia[r.via]}</span>
                <span>·</span>
                <span>{d.reqAttempt(r.attempt)}</span>
                <span>·</span>
                <span>{d.reqStatus(r.status)}</span>
                <span>·</span>
                <span>{formatMs(r.ms)}</span>
                {r.items !== undefined && (
                  <>
                    <span>·</span>
                    <span>{d.reqItems(r.items)}</span>
                  </>
                )}
                {r.code && <CodeBadge code={r.code} />}
                {r.note && <em>{r.note}</em>}
              </span>
              <code class="diag-pre">{r.url}</code>
              {r.snippet && (
                <>
                  <span class="text-meta">{d.responseStart}</span>
                  <code class="diag-pre">{r.snippet}</code>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScanRow({ scan }: { scan: ScanRecord }) {
  const d = copy.diagnostics;
  const [open, setOpen] = useState(!scan.ok);
  return (
    <>
      <tr class="diag-row" onClick={() => setOpen((v) => !v)}>
        <td class="text-meta">
          <button type="button" class="disclosure-trigger" aria-expanded={open}>
            {open ? "▾" : "▸"}
          </button>{" "}
          {formatTime(scan.startedAt)}
        </td>
        <td class="text-body">
          {scan.kind === "health" ? d.healthScan : scan.watchName}
          {scan.baseline && <span class="text-meta"> · {d.baseline}</span>}
        </td>
        <td>
          {scan.ok ? (
            <span class="fx ac gap1 text-meta">
              <span class="status-dot status-dot--ok" />
              {d.ok}
            </span>
          ) : (
            scan.errorCode && <CodeBadge code={scan.errorCode} />
          )}
        </td>
        <td class="text-meta">
          {scan.fetched} / {scan.matched} / {scan.inserted}
        </td>
        <td class="text-meta">{formatMs(scan.durationMs)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            <ScanDetails scan={scan} />
          </td>
        </tr>
      )}
    </>
  );
}

export function DiagnosticsScreen() {
  const d = copy.diagnostics;
  const [health, setHealth] = useState<SiteHealth[]>([]);
  const reloadHealth = useCallback(() => {
    void storage.siteHealth.list().then(setHealth);
  }, []);
  useEffect(() => {
    reloadHealth();
    const id = setInterval(reloadHealth, 3000);
    return () => clearInterval(id);
  }, [reloadHealth]);
  const { scans, reload: reloadScans } = useScanLog();
  const logs = useLogEntries();
  const [env, setEnv] = useState<DiagnosticsEnvironment | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const reloadEnv = useCallback(() => {
    void getDiagnosticsEnvironment()
      .then(setEnv)
      .catch(() => setEnv(null));
  }, []);
  useEffect(reloadEnv, [reloadEnv]);

  async function runTest() {
    setTesting(true);
    setMessage(null);
    try {
      const [record] = await testConnection();
      setMessage(
        !record
          ? null
          : record.ok
            ? d.testOk(record.fetched)
            : d.testFailed(record.errorCode ?? "APP-UNKNOWN"),
      );
    } catch (err) {
      setMessage(d.testFailed(err instanceof Error ? err.message : String(err)));
    } finally {
      setTesting(false);
      reloadHealth();
      reloadScans();
      reloadEnv();
    }
  }

  async function copyReport() {
    const report = buildDiagnosticsReport({ environment: env, health, scans, logs });
    await navigator.clipboard.writeText(report);
    setMessage(d.copied);
  }

  async function clearLog() {
    await storage.scans.clear();
    reloadScans();
  }

  const visibleScans = onlyErrors ? scans.filter((s) => !s.ok) : scans;

  return (
    <div class="col gap4">
      <div class="col gap1">
        <span class="text-title">{d.title}</span>
        <span class="text-meta">{d.intro}</span>
      </div>

      <div class="options-panel">
        <span class="text-offer-title">{d.statusSection}</span>
        {health.map((h) => (
          <HealthRow key={h.site} h={h} />
        ))}
        <div class="fx ac gap2 wrap">
          <button
            type="button"
            class="btn btn-primary"
            disabled={testing}
            onClick={() => void runTest()}
          >
            {testing ? d.testing : d.testConnection}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => void copyReport()}
          >
            {d.copyReport}
          </button>
          {message && (
            <span class="text-meta" role="status">
              {message}
            </span>
          )}
        </div>
      </div>

      <EnvironmentPanel env={env} />

      <div class="options-panel">
        <div class="fx ac jb wrap gap2" style={{ flexDirection: "row" }}>
          <span class="text-offer-title">{d.scansSection}</span>
          <span class="fx ac gap2">
            <select
              class="select-field"
              style={{ width: "auto" }}
              aria-label={d.scansSection}
              value={onlyErrors ? "errors" : "all"}
              onChange={(e) =>
                setOnlyErrors((e.target as HTMLSelectElement).value === "errors")
              }
            >
              <option value="all">{d.filterAll}</option>
              <option value="errors">{d.filterErrors}</option>
            </select>
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => void clearLog()}
            >
              {d.clearLog}
            </button>
          </span>
        </div>
        {visibleScans.length === 0 ? (
          <span class="text-meta">{d.scansEmpty}</span>
        ) : (
          <table class="options-table">
            <thead>
              <tr>
                <th>{d.colTime}</th>
                <th>{d.colWhat}</th>
                <th>{d.colResult}</th>
                <th>{d.colCounts}</th>
                <th>{d.colDuration}</th>
              </tr>
            </thead>
            <tbody>
              {visibleScans.map((s) => (
                <ScanRow key={s.id} scan={s} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div class="options-panel">
        <Disclosure title={d.techLogSection}>
          {logs.length === 0 ? (
            <span class="text-meta">{d.techLogEmpty}</span>
          ) : (
            <div class="col gap1">
              {logs.slice(0, 100).map((l, i) => (
                <code key={i} class={`diag-pre diag-log diag-log--${l.level}`}>
                  {formatTime(l.at)} [{l.level}] {l.message}
                  {l.meta ? ` ${JSON.stringify(l.meta)}` : ""}
                </code>
              ))}
            </div>
          )}
        </Disclosure>
      </div>
    </div>
  );
}
