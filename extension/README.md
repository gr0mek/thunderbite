# Thunder Bait

Chrome MV3 extension that watches OLX, Vinted and Allegro for matching offers
and notifies you (browser + email) when one shows up.

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
