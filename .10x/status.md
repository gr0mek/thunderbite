# Status

- Phase: **Discovery Complete** → Phase 0 Brainstorming for `mvp-cloud-version`
- Feature `mvp-cloud-version`: run Thunder Bait in the cloud (no browser needed) + Telegram/Discord notifications.
- Blockers: none yet. Key risk: whether Vinted (DataDome) serves api.vinted.pl to datacenter IPs.

## Brainstorming answers so far (2026-10-02)
- Audience: me + a few friends (invite-only, per-user watches and channels).
- UI: web panel + Telegram bot (login via Telegram, a few bot commands).
- Channels: Telegram in MVP, Discord (webhook) next.
- Hosting: cheap VPS in Docker; plan B = home Raspberry Pi/NAS or residential proxy, decided by a step-0 Vinted access test.
- Extension: stays as-is, independent; shared code moves to a workspace package.
- Proposed approach A (TS monolith: Hono + Preact panel + scheduler + grammY + SQLite) — awaiting user approval.
