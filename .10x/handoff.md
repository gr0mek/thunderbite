# Handoff

From: SDE (stage 0) → To: user (run the probe) / SDE (stage 1)

- User: run `server/` probe on the target VPS for 24 h (see `server/README.md`), send back the summary line + a few error lines.
- Verdict OK → continue on the VPS. PARTIAL/BLOCKED → re-run with `--proxy` or on a home device before stage 4.
- Stage 1 (extract `packages/core`) does not depend on the probe and can start now.
