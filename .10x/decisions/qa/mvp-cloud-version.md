# mvp-cloud-version — QA

## Stage 0 probe
- Unit tests (11, vitest): cookie parsing, headers, URL building, status→code mapping, body classification (items / empty / wrong shape / HTML challenge), summary verdicts including the refresh-then-OK round, failure streaks, NO-CONNECTION vs BLOCKED, no data.
- End-to-end against a local mock of www + svc-catalogue:
  - 403 → new session (`tok2`) → OK;
  - HTML challenge classified as VNT-JSON;
  - 429 not retried;
  - the mock confirmed Bearer, x-anon-id, Origin and the browser UA were sent;
  - `--summarize` reproduced the verdict.
- Dead proxy → NO-CONNECTION.
- **Not verified against real Vinted:** the sandbox's egress blocks vinted.pl (ADR-001), so the run returns 403 from the sandbox, not from Vinted. The real result must come from the user's VPS.
