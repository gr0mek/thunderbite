# Handoff

From: Architect + Staff Engineer → To: Engineering Manager + Senior Engineer (Planning)

- Approved design: `.10x/specs/2026-10-02-mvp-cloud-version-design.md`; decision record: `docs/adr-007-cloud-server.md`.
- Planning must break stages 0–5 into ≤ half-day tasks. Stage 0 (probe) is independent and should ship first so the user can run it on the VPS while stage 1 proceeds.
- Watch-out for stage 1: `core/checkWatch.ts` imports types from `background/` (Notifier, SiteRateLimiter) — move these interfaces into core.
