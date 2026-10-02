# Handoff

From: Discovery → To: Brainstorming (all roles)

- Codebase discovered; see decisions/*/_index.md ([DISCOVERED] tags).
- User request (2026-10-02): analyse a web/cloud version so monitoring runs without an open browser; MVP + action plan; notifications to Telegram or Discord.
- Reusable: `extension/src/core/*`, `adapters/vinted/api.ts` + parsing, `shared/schemas.ts`. Must replace: transport (chrome.cookies/scripting), storage repos, alarms, notifier.
