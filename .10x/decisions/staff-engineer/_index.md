# Staff Engineer — index [DISCOVERED]
- TS strict, path alias `@/` → `src/`. zod schemas in `shared/schemas.ts` are the single source of data shapes.
- All UI copy in Polish via `shared/copy.pl.ts`; no chrome.i18n.
- Stable scan error codes (`VNT-*`, `APP-*`): never change meaning, only add.
- Tests: vitest + jsdom + fake-indexeddb; 86 tests. CI: `.github/workflows/extension-ci.yml` (format, lint, build, test).
- ADRs live in `docs/adr-NNN-*.md` (001–006).
