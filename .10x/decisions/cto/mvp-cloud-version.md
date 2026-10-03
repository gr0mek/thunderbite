# mvp-cloud-version — CTO

- **Verdict:** build. A cloud runner is the only way to monitor without an open browser, and about 80% of the logic already exists in `core/`.
- **Build vs buy:** forking Vinted-Notifications was rejected. It loses deal mode, exclusions, diagnostics and the Polish UX, and adds a second language.
- **Stack:** TypeScript monolith (Node 22, Hono, grammY, better-sqlite3, Preact). One container. Budget about 4–6 €/month VPS.
- **Biggest risk:** Vinted/DataDome blocking datacenter IPs. Stage 0 measures it before any investment; plan B is a home device or a residential proxy.
- **Scope guard:** invite-only for a few people. Going public needs a new ADR.
