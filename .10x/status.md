# Status

- Feature: `mvp-cloud-version` — Thunder Bait in the cloud (no browser) + Telegram/Discord notifications.
- Phase: **Design Complete** (spec + ADR-007 approved 2026-10-02). Next: Planning.
- PR: https://github.com/gr0mek/thunderbite/pull/6 (branch `mvp-cloud-version`).
- Key risk: Vinted/DataDome blocking the VPS IP → stage 0 probe first.

## Stages
- [ ] 0 Vinted access probe on the VPS
- [ ] 1 Extract `packages/core` (npm workspaces)
- [ ] 2 Server core: SQLite, scheduler, Vinted transport, Telegram channel + bot
- [ ] 3 Web panel
- [ ] 4 Docker/Caddy deploy + backups
- [ ] 5 Discord webhook channel
