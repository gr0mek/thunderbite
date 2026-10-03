# Status

- Feature: `mvp-cloud-version` — Thunder Bait in the cloud (no browser) + Telegram/Discord notifications.
- Phase: **Implementation — stage 0 built**, waiting for the probe result from the VPS. Stage 1 can start in parallel.
- PR: https://github.com/gr0mek/thunderbite/pull/6 (branch `mvp-cloud-version`).
- Key risk: Vinted/DataDome blocking the VPS IP → stage 0 probe first.

## Stages
- [~] 0 Vinted access probe — built and tested with mocks; waiting for the user to run it on the VPS
- [ ] 1 Extract `packages/core` (npm workspaces)
- [ ] 2 Server core: SQLite, scheduler, Vinted transport, Telegram channel + bot
- [ ] 3 Web panel
- [ ] 4 Docker/Caddy deploy + backups
- [ ] 5 Discord webhook channel
