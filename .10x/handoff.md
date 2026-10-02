# Handoff

From: Engineering Manager + Senior Engineer → To: SDE (Implementation)

- Ordered tasks: `.10x/decisions/engineering-manager/mvp-cloud-version.md`; approach and tricky parts: `.10x/decisions/senior-engineer/mvp-cloud-version.md`.
- Start with stage 0 (`server/scripts/vinted-probe.ts`). The user runs it on the VPS for 24 h; its result decides VPS vs plan B.
- Stage 1 can proceed in parallel with the probe run.
