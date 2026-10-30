# CLAUDE.md

Context for AI coding agents working in this repository.

## Project

punchline is a Chrome extension (Manifest V3) that syncs daily working hours from the
Harvest API into the HRworks web UI. TypeScript, bundled with esbuild, no runtime
dependencies.

## Layout

- `src/manifest.json`: extension manifest (version must match `package.json`)
- `src/background.ts`: service worker entry
- `src/popup/`: popup UI (`popup.html`, `popup.ts`, `popup.css`)
- `scripts/`: build, package and policy checks, run directly by Node (type stripping)
- `scripts/lib/`: tested logic behind the checks
- `docs/`: local-only reference material (HAR files, screenshots). Only `*.md` is committed.

## Commands

```sh
npm run setup          # install + enable git hooks
npm run check          # lint + format with auto-fix (Biome)
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run coverage       # vitest with coverage thresholds
npm run build          # bundle to dist/
npm run package        # zip dist/
npm run verify         # everything CI runs. Must pass before you hand work back.
```

## Conventions

- TypeScript strict mode. Only erasable syntax (no enums or namespaces). Relative imports
  use the `.ts` extension.
- Biome formatting: 2 spaces, single quotes, 100 columns.
- Tests sit next to the code as `*.test.ts`. Put logic in small, pure modules so it can be
  tested without Chrome. Keep entry points thin.
- Keep dependencies minimal. Ask before adding one.
- Comments explain _why_, not _what_.

## Security rules (non-negotiable)

- **Host access** is limited to `api.harvestapp.com`, `id.getharvest.com`, `hrworks.de` and
  `*.hrworks.de`. **API permissions** are limited to `storage` and `alarms`. Both lists are in
  `scripts/lib/manifest-policy.ts`. Never widen them without explicit approval from the maintainer.
- Never commit secrets, tokens, `.env` files, HAR files, HRworks screenshots or HTML snapshots.
  Test fixtures must be synthetic or anonymised.
- Store credentials only in `chrome.storage`. Never log them or send them anywhere other than
  the Harvest API.
- No remote code: no `eval`, no CDN scripts, no relaxed CSP.
- Never disable or skip tests, linters or security checks to get CI green.

## Feature brief

<!-- ===================== PASTE FEATURE PROMPT BELOW ===================== -->

_Not yet provided._

<!-- ===================== END FEATURE PROMPT ===================== -->
