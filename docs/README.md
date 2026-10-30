# docs/

This folder holds **local-only reference material** for development, for example:

- **HAR files** (`*.har`) recorded from Harvest or HRworks in DevTools
- **DevTools Recorder exports** (`*.json`, `*.js`)
- **HTML snapshots** of HRworks pages (`*.html`, `*.mhtml`)
- **Screenshots** of HRworks or Harvest (`*.png`, `*.jpg`, …)

> [!CAUTION]
> These files contain session cookies, access tokens, names, working hours and other
> personal data. **They must never be committed.**

Everything in `docs/` except Markdown files is git-ignored, and both the pre-commit hook
and CI (`npm run check:files`) reject such files even if they are force-added.

Before you share an excerpt in an issue or PR, strip cookies, tokens, names and IDs.

Markdown documentation (`*.md`) may be committed here as usual.
