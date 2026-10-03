# mvp-cloud-version — Security

## Stage 0 probe
- **Session secrecy:** it holds only an anonymous Vinted session (no account, no credentials). Token values are never written to the log; the session line records only `token=yes/no`.
- **Proxy credentials:** a `--proxy` URL may contain credentials. It is not logged; only "via proxy" is printed.
- **Request volume:** one request every 5 min by default, at most 3 per round, so the probe is not abusive towards Vinted.
- **Response snippets:** failure lines include up to 160 chars of the response body, so a challenge page can be told apart from an API error. That is public content, not user data.

## Server (stages 2–4)
Threat model and controls are in the spec's Security section. The review happens when that code exists.
