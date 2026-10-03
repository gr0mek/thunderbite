# mvp-cloud-version — SDE

## Stage 0 (2026-10-03): Vinted access probe — built
- `server/scripts/vinted-probe.ts` (CLI) + `server/scripts/probe-lib.ts` (pure helpers), run with `npm run probe` (tsx).
- Contract mirrors the extension (ADR-005):
  - session from `GET www.vinted.pl/` cookies (`access_token_web`, `anon_id`, all cookies sent back);
  - `GET api.vinted.pl/svc-catalogue/items` with Bearer, x-anon-id, Origin/Referer and a browser User-Agent;
  - refresh + retry on 401/403, at most 3 attempts per round.
- Output: one JSON line per HTTP attempt (stdout + `probe.jsonl`), and a summary with a verdict of OK / PARTIAL / BLOCKED / NO-CONNECTION. Ctrl-C/SIGTERM still print the summary; `--summarize <file>` recomputes it from a log.
- `--proxy` (undici ProxyAgent) checks plan B with the same script.
- `server/` package: tsx, undici; dev: typescript, vitest, prettier. CI: `.github/workflows/server-ci.yml` (format, typecheck, test).

## Deviations from plan
- The probe does **not** import the extension's adapter files (as the senior-engineer note suggested). They pull in zod from `extension/node_modules`, so the VPS would need the whole extension toolchain installed. A few constants (URLs, headers, status-code mapping) are duplicated in `probe-lib.ts`, which is marked for replacement by `packages/core` in stage 1.
- Added the `NO-CONNECTION` verdict, so a dead proxy or network isn't reported as a Vinted block.

## Tech debt
- Duplicated Vinted request constants in `server/scripts/probe-lib.ts` (remove in stage 1).
