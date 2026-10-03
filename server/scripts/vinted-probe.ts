// Stage 0 of mvp-cloud-version: can this host reach Vinted's catalogue?
//
// Polls svc-catalogue the same way the extension does (docs/adr-005) on a
// fixed interval, prints one JSON line per HTTP attempt and a verdict at the
// end. Run it on the VPS that is meant to host the server — Vinted's anti-bot
// layer judges the IP, so a result from anywhere else says nothing.
//
//   npx tsx scripts/vinted-probe.ts                       # 24 h, every 5 min
//   npx tsx scripts/vinted-probe.ts --rounds 3 --interval 1
//   npx tsx scripts/vinted-probe.ts --proxy http://user:pass@host:port
//   npx tsx scripts/vinted-probe.ts --summarize probe.jsonl
//
// See server/README.md for how to run it unattended and read the result.

import { appendFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fetch, ProxyAgent, type Dispatcher } from "undici";
import {
  BROWSER_HEADERS,
  VINTED_API_URL,
  VINTED_WEB_URL,
  catalogHeaders,
  catalogUrl,
  classifyCatalogBody,
  codeForStatus,
  parseSetCookies,
  sessionFromCookies,
  snippet,
  summarize,
  type Attempt,
  type ProbeCode,
  type VintedSession,
} from "./probe-lib.ts";

const { values: args } = parseArgs({
  options: {
    interval: { type: "string", default: "5" }, // minutes between rounds
    hours: { type: "string", default: "24" },
    rounds: { type: "string" }, // overrides --hours
    query: { type: "string", default: "nike" },
    proxy: { type: "string" },
    out: { type: "string", default: "probe.jsonl" },
    timeout: { type: "string", default: "20" }, // seconds per request
    summarize: { type: "string" },
    // Test hooks: point the probe at a local mock instead of Vinted.
    "web-url": { type: "string", default: VINTED_WEB_URL },
    "api-url": { type: "string", default: VINTED_API_URL },
  },
});

const MAX_CATALOG_ATTEMPTS = 3;

function emit(record: object): void {
  const line = JSON.stringify(record);
  console.log(line);
  appendFileSync(args.out, line + "\n");
}

function printSummary(attempts: Attempt[]): void {
  const s = summarize(attempts);
  emit({ step: "summary", ...s });
  const pct = (s.successRate * 100).toFixed(1);
  const advice = {
    OK: "This host can run the scanner.",
    PARTIAL:
      "Usable, but expect gaps; consider plan B (home device or residential proxy).",
    BLOCKED:
      "Vinted blocks this host. Use plan B: a home device or --proxy with a residential proxy.",
    "NO-CONNECTION":
      "Vinted never answered: check the host's network or the --proxy URL.",
    "NO-DATA": "No rounds completed.",
  }[s.verdict];
  console.error(
    `\nVerdict: ${s.verdict} — ${s.okRounds}/${s.rounds} rounds OK (${pct}%), ` +
      `longest failure streak ${s.longestFailureStreak}, ` +
      `median catalogue time ${s.medianCatalogMs ?? "–"} ms.\n${advice}`,
  );
}

if (args.summarize) {
  const attempts = readFileSync(args.summarize, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Attempt & { step: string })
    .filter((a): a is Attempt => a.step === "session" || a.step === "catalog");
  args.out = "/dev/null";
  printSummary(attempts);
  process.exit(0);
}

const intervalMs = Number(args.interval) * 60_000;
const totalRounds = args.rounds
  ? Number(args.rounds)
  : Math.max(1, Math.floor((Number(args.hours) * 60) / Number(args.interval)));
const timeoutMs = Number(args.timeout) * 1000;
const dispatcher: Dispatcher | undefined = args.proxy
  ? new ProxyAgent(args.proxy)
  : undefined;
const webUrl = args["web-url"];
const apiUrl = args["api-url"];

const attempts: Attempt[] = [];
let session: VintedSession | null = null;

function record(a: Omit<Attempt, "ts">): Attempt {
  const full = { ts: new Date().toISOString(), ...a };
  attempts.push(full);
  emit(full);
  return full;
}

async function timed(url: string, headers: Record<string, string>) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      ...(dispatcher ? { dispatcher } : {}),
    });
    const body = await res.text();
    return { ok: true as const, res, body, ms: Date.now() - started };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const code: ProbeCode =
      name === "TimeoutError" || name === "AbortError" ? "VNT-TIMEOUT" : "VNT-NET";
    const message =
      err instanceof Error ? `${err.message} ${String(err.cause ?? "")}` : String(err);
    return { ok: false as const, code, message, ms: Date.now() - started };
  }
}

/** Loads the home page for fresh session cookies (access_token_web, anon_id). */
async function bootstrapSession(round: number): Promise<VintedSession | null> {
  const r = await timed(`${webUrl}/`, {
    ...BROWSER_HEADERS,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  });
  if (!r.ok) {
    record({
      round,
      step: "session",
      status: null,
      ms: r.ms,
      code: r.code,
      snippet: snippet(r.message),
    });
    return null;
  }
  const s = sessionFromCookies(parseSetCookies(r.res.headers.getSetCookie()));
  const code: ProbeCode = r.res.status >= 400 ? codeForStatus(r.res.status) : "OK";
  record({
    round,
    step: "session",
    status: r.res.status,
    ms: r.ms,
    code,
    ...(code === "OK" && s.token
      ? {}
      : {
          snippet: `token=${s.token ? "yes" : "no"} anon_id=${s.anonId ? "yes" : "no"} ${snippet(r.body, 100)}`,
        }),
  });
  return s;
}

async function runRound(round: number): Promise<void> {
  for (let attempt = 1; attempt <= MAX_CATALOG_ATTEMPTS; attempt++) {
    if (!session?.token) session = (await bootstrapSession(round)) ?? null;
    const r = await timed(
      catalogUrl(apiUrl, args.query),
      catalogHeaders(session ?? { cookieHeader: "" }),
    );
    if (!r.ok) {
      record({
        round,
        step: "catalog",
        status: null,
        ms: r.ms,
        code: r.code,
        snippet: snippet(r.message),
      });
      return; // network trouble is not fixed by a new session
    }
    const status = r.res.status;
    if (status === 200) {
      const { code, items } = classifyCatalogBody(r.body);
      record({
        round,
        step: "catalog",
        status,
        ms: r.ms,
        code,
        items,
        ...(code === "OK" ? {} : { snippet: snippet(r.body) }),
      });
      return;
    }
    const code = codeForStatus(status);
    record({ round, step: "catalog", status, ms: r.ms, code, snippet: snippet(r.body) });
    // Same policy as the extension: a rejected token gets a fresh session and
    // another try; anything else (404, 429, 5xx) waits for the next round.
    if (status !== 401 && status !== 403) return;
    session = null;
  }
}

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (stopping) process.exit(1);
    stopping = true;
    printSummary(attempts);
    process.exit(0);
  });
}

console.error(
  `Probing ${apiUrl}${args.proxy ? " via proxy" : ""}: ${totalRounds} rounds, every ${args.interval} min, query "${args.query}". Log: ${args.out}`,
);
for (let round = 1; round <= totalRounds && !stopping; round++) {
  await runRound(round);
  if (round < totalRounds) await new Promise((r) => setTimeout(r, intervalMs));
}
printSummary(attempts);
