# Contributing

## Setup

Prerequisites: [Node.js](https://nodejs.org/) 24 (see `.nvmrc`) and
[gitleaks](https://github.com/gitleaks/gitleaks#installing) (`brew install gitleaks`).

```sh
git clone https://github.com/gruesomeparty/punchline.git
cd punchline
npm run setup   # installs dependencies and enables the git hooks
```

The pre-commit hook **refuses to commit** if gitleaks is missing. It blocks secrets and local-only
files (HAR files, screenshots, `.env`, …). See [`docs/README.md`](docs/README.md).

## Load the extension in Chrome

```sh
npm run dev     # or `npm run build` for a one-off build
```

Open `chrome://extensions`, enable _Developer mode_, click _Load unpacked_ and pick `dist/`.

## Commands

| Command                           | What it does                                       |
| --------------------------------- | -------------------------------------------------- |
| `npm run check`                   | Lint + format (auto-fix)                           |
| `npm run lint` / `npm run format` | Lint only / format only                            |
| `npm run typecheck`               | TypeScript type check                              |
| `npm test` / `npm run coverage`   | Tests / tests with coverage                        |
| `npm run build` / `npm run dev`   | Build to `dist/` / rebuild on change               |
| `npm run package`                 | Zip `dist/` into `punchline-<version>.zip`         |
| `npm run check:manifest`          | Verify extension permissions against the allowlist |
| `npm run check:files`             | Verify no forbidden files are tracked              |
| `npm run verify`                  | Everything CI runs                                 |

## Workflow

1. Branch off `main`, keep PRs small and focused.
2. Add tests for new logic. Coverage must stay above the threshold in `vitest.config.ts`.
3. Run `npm run verify` before pushing.
4. Open a PR. CI, CodeQL, the security scans and a review must pass before merge.
5. Title the PR as a [Conventional Commit](https://www.conventionalcommits.org), e.g.
   `feat(popup): show sync status`. PRs are squash-merged, so the title becomes the commit on
   `main`. The `PR title` workflow checks it.

### GitHub settings

Repository settings (merge rules, security features, Actions policy, branch ruleset) live in
[`scripts/github-settings.sh`](scripts/github-settings.sh). A repo admin applies them with `gh`.

### Permissions

The extension may only access the Harvest API and HRworks. Allowed hosts and permissions live
in [`scripts/lib/manifest-policy.ts`](scripts/lib/manifest-policy.ts). Changing that list needs
its own PR with a justification.

### Real data

Never commit real tokens, HAR files, HRworks screenshots or HTML snapshots. Use small,
anonymised fixtures in tests. Recordings and snapshots live in the private
`punchline-internal` repo. Ask for access and clone it next to this one (see
[`docs/README.md`](docs/README.md)).

### Dependencies

Prefer the platform and no dependency at all. Updates arrive weekly through Renovate.
