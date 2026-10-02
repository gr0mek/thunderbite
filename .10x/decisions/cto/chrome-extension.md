# chrome-extension — CTO [DISCOVERED]
- All scheduling, matching, dedup and storage live in the browser; backend only sends email.
- Consequence: monitoring stops whenever the browser is closed. This is the motivation for `cloud-worker`.
