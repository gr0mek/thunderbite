# Thunder Bait

Chrome MV3 extension that watches Vinted and eBay for matching offers and
notifies you (browser + email) when one shows up (eBay: docs/adr-007).
Originally scoped for OLX, Vinted and Allegro; narrowed to Vinted only per a
later product decision — the
`SiteId`/adapter architecture is still generic, so a second site can be
added back without a redesign.

Implementation of the design handed off in `../SmartBuy MVP.dc.html` per the
specs in `../chats/chat1.md`, `../project/uploads/startSmartBuy.md` (build
rules) and `../project/uploads/uxSmartBuy.md` (UX/content spec). The product
was renamed **Thunder Bait** partway through design; the repo, types and
docs still say `smart-buy` / `SmartBuy` in a few structural places inherited
from the spec — only user-facing copy and branding use the new name.

## Development

```sh
npm install
npm run dev      # vite dev server with HMR
npm run build    # type-check + production build to dist/
npm test         # vitest
npm run lint
npm run format
```

Load `dist/` as an unpacked extension via `chrome://extensions` (Developer
mode → Load unpacked) to try it locally.

## Layout

See `../project/uploads/startSmartBuy.md` §4 for the full intended
structure. `docs/adr-*.md` (repo root `docs/`) records non-obvious decisions,
e.g. how the Vinted adapter fetches data.

## Manual browser QA

Vitest covers logic; there's no automated UI test runner wired in yet, so UI
changes need a real-browser pass. `playwright-core` and `axe-core` are dev
dependencies for exactly this — an MV3 extension only loads with a real
(non-headless) Chromium, so in a container without a display, run it under
Xvfb:

```sh
npm run build
xvfb-run -a node -e '
import("playwright-core").then(async ({ chromium }) => {
  const ctx = await chromium.launchPersistentContext("/tmp/pw-profile", {
    headless: false,
    args: ["--no-sandbox",
      "--disable-extensions-except=" + process.cwd() + "/dist",
      "--load-extension=" + process.cwd() + "/dist"],
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  console.log("extension id:", new URL(sw.url()).host);
  // open chrome-extension://<id>/src/ui/popup/index.html or .../options/index.html,
  // seed chrome.storage.local + IndexedDB via page.evaluate() to get real data on
  // screen, then page.screenshot() / inject node_modules/axe-core/axe.min.js via
  // page.evaluate(source) (NOT addScriptTag — MV3 pages CSP-block inline <script>
  // tags, but evaluate() runs through CDP and isn'\''t subject to it) and run
  // axe.run(document, { runOnly: { type: "tag", values: ["wcag2a","wcag2aa"] } }).
});
'
```
