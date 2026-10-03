# Thunder Bait server

The cloud version of Thunder Bait (feature `mvp-cloud-version`). The design is
in `../.10x/specs/2026-10-02-mvp-cloud-version-design.md` and
`../docs/adr-007-cloud-server.md`.

Only **stage 0**, the Vinted access probe, is here so far.

## Stage 0: can this host reach Vinted?

Vinted's anti-bot layer judges the IP address. So run the probe **on the
machine that will host the server** (the VPS you rent, or the home device for
plan B). A result from your laptop or from CI says nothing about the VPS.

### Requirements

- Node.js 22 or newer.
- git.

### Run it for 24 hours

```sh
git clone https://github.com/gr0mek/thunderbite.git
cd thunderbite
git checkout mvp-cloud-version
cd server
npm ci

# 288 rounds, one every 5 minutes, logged to probe.jsonl
nohup npm run probe > probe.out 2>&1 &
```

The probe uses very little memory and CPU. Each round sends one request, or
a few when the session needs refreshing. That is gentler than a single person
browsing.

Check on it while it runs:

```sh
tail -f probe.out
```

Stop it early with `kill %1` or `pkill -f vinted-probe`. It still prints the
verdict when stopped this way.

If the process was killed hard, recompute the verdict from the log:

```sh
npm run probe -- --summarize probe.jsonl
```

### Reading the result

The last lines print a verdict:

| Verdict         | Meaning                           | Next step                                                       |
| --------------- | --------------------------------- | --------------------------------------------------------------- |
| `OK`            | ≥ 95% of rounds returned listings | The VPS can host the server                                     |
| `PARTIAL`       | 60–95%                            | Usable with backoff, but expect gaps. Try plan B for comparison |
| `BLOCKED`       | < 60%                             | Vinted refuses this IP. Use plan B                              |
| `NO-CONNECTION` | Vinted never answered             | Network or `--proxy` problem, not a block                       |

What the error codes mean (the same codes as the extension's Diagnostyka
screen):

| Code                      | Meaning                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `VNT-403`                 | Refused. Usually an IP block (DataDome)                         |
| `VNT-429`                 | Rate limited                                                    |
| `VNT-JSON`                | HTTP 200 but an HTML page. Almost always a captcha or challenge |
| `VNT-401`                 | Token rejected. The probe fetches a new session and retries     |
| `VNT-NET` / `VNT-TIMEOUT` | No answer                                                       |

Please send back the summary line and about 10 lines with errors (`grep -v '"code":"OK"' probe.jsonl | head`).

### Plan B checks

- **Through a proxy**, for example a residential proxy or a tunnel to your
  home network:

  ```sh
  npm run probe -- --proxy http://user:pass@host:port --out probe-proxy.jsonl
  ```

- **On a home device** (Raspberry Pi, NAS, laptop): the same commands as
  above, run there.

### Options

| Option       | Default       |                                               |
| ------------ | ------------- | --------------------------------------------- |
| `--hours`    | `24`          | Total duration                                |
| `--interval` | `5`           | Minutes between rounds                        |
| `--rounds`   | —             | Fixed number of rounds instead of `--hours`   |
| `--query`    | `nike`        | Search phrase                                 |
| `--proxy`    | —             | HTTP(S) proxy URL                             |
| `--out`      | `probe.jsonl` | Log file (one JSON object per line, appended) |
| `--timeout`  | `20`          | Seconds per request                           |

## Development

```sh
npm ci
npm run typecheck
npm test
```
