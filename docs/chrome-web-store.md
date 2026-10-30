# Publishing to the Chrome Web Store

Everything needed to list punchline in the Chrome Web Store, ready to paste into the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole). Keep it in sync with
`src/manifest.json`: if a permission changes, update its justification here and in
[privacy-policy.md](privacy-policy.md).

## Choosing a visibility

|                  | Unlisted (recommended)                                          | Private, Google Workspace domain                                 | GitHub Release zip only        |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| Who can install  | Anyone with the link                                            | Only accounts in your Workspace domain                           | Anyone, via Developer mode     |
| Install          | One click from the link                                         | One click, or pushed by the Workspace admin                      | Download, unzip, Load unpacked |
| Updates          | Automatic                                                       | Automatic                                                        | Manual, every release          |
| Review by Google | Yes                                                             | Yes                                                              | None                           |
| Needs            | $5 one-time developer fee, privacy policy, justifications below | The developer account must be a Workspace account of that domain | Nothing                        |

Unlisted works whatever email address colleagues use and keeps auto-updates. The code is public
anyway, so hiding the listing from search is enough. Until the listing exists, and as a
fallback afterwards, every release attaches the zip to a GitHub Release.

## One-time setup (maintainer)

1. Register at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and pay
   the one-time $5 fee. Use an account you'll keep: listings can't be moved later without
   support. Consider a [group publisher](https://developer.chrome.com/docs/webstore/group-publishers)
   so someone else can publish too.
2. Verify the contact email in **Account**.
3. Release a version (below) and download `punchline-<version>.zip` from the GitHub Release.
4. **Add new item**, upload the zip, then fill in the tabs with the texts below.
5. **Distribution → Visibility: Unlisted**. Regions: all.
6. **Submit for review**. Reviews usually take a few days. Wildcard host access can make it take
   longer. Once approved, copy the item URL from the dashboard: that's the install link.

## Releasing a version

Releases are cut by [release-please](https://github.com/googleapis/release-please) from the
Conventional Commit titles on `main`:

1. Every merge to `main` updates an open **release PR** (`chore(main): release X.Y.Z`). It bumps
   `package.json`, `src/manifest.json` and `.release-please-manifest.json`, and writes
   `CHANGELOG.md`. `feat` bumps the minor version, `fix` the patch version (while below 1.0).
2. Merge the release PR when you want to ship. That tags `vX.Y.Z` and creates the GitHub
   Release.
3. The **Attach extension zip** job then runs the full verify on the tag and attaches
   `punchline-X.Y.Z.zip` and `SHA256SUMS.txt` to the release. Colleagues install from
   [the latest release](https://github.com/gruesomeparty/punchline/releases/latest).
4. Once the store listing exists: **Package → Upload new package** with that zip, then submit
   for review. Chrome updates installed copies by itself after approval.

### One-time setup for release-please

- Add `googleapis/release-please-action@*` to the allowed actions. It's in
  `scripts/github-settings.sh`, so re-run that script.
- Create a fine-grained personal access token for this repository only, with **Contents**,
  **Pull requests** and **Issues** set to read and write (issues covers the release labels).
  Save it as the repository secret `RELEASE_PLEASE_TOKEN`. GitHub Actions in this repo may not
  open PRs with their own token, and a PR opened that way wouldn't run the required checks.

## Store listing tab

**Name:** punchline

**Summary** (max 132 characters):

> Copies your daily working hours from Harvest into HRworks. Preview every day first, then write them in one click.

**Category:** Productivity (Workflow & Planning)

**Language:** English

**Description:**

> punchline fills in your HRworks working times from the hours you already tracked in Harvest.
>
> Pick a date range and punchline shows each day side by side: what Harvest says, the start and end time it will write (with the mandatory break added), and what HRworks has now. Days that already match fold away, so you only see what needs action. Write one day, or write a whole range at once after a Before and After check.
>
> How it works
> • Reads your daily totals from the Harvest API with your own personal access token.
> • Adds breaks by Swiss or German rules, or your own, to get a start and end time.
> • Fills in the HRworks Arbeitszeiten page in your logged-in browser tab and checks every save.
> • Days that differ are flagged, or overridden if you choose; the old HRworks times are logged first.
>
> Privacy
> • No punchline server, no account, no analytics.
> • Your Harvest token stays in your browser and is sent only to the Harvest API.
> • punchline never sees your HRworks password; it works in the session you're already logged in to.
>
> punchline is open source (MIT): https://github.com/gruesomeparty/punchline
>
> punchline is an independent tool and is not affiliated with Harvest or HRworks.

**Graphics** (in [`assets/store/`](../assets/store/), made from synthetic data):

| Field                      | File                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| Store icon (128×128)       | `src/icons/icon-128.png`                                                         |
| Screenshots (1280×800)     | `assets/store/screenshot-1-preview.png`, `assets/store/screenshot-2-confirm.png` |
| Small promo tile (440×280) | `assets/store/promo-tile-440x280.png`                                            |

**Additional fields:** Homepage URL `https://github.com/gruesomeparty/punchline`, support URL
`https://github.com/gruesomeparty/punchline/issues`.

## Privacy practices tab

**Single purpose:**

> punchline copies the user's daily working hours from their Harvest account into the working-time page of HRworks, after showing a preview of every change.

**Permission justifications:**

| Permission                                                           | Justification                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                            | Keeps the user's settings (Harvest token and account ID, start time, break rules, preview mode, theme) and a local log of the times punchline wrote, including the previous HRworks times, in chrome.storage.local. Nothing is synced or sent elsewhere.                                                        |
| `sidePanel`                                                          | Shows the preview of days to write in Chrome's side panel, so the user can watch the HRworks page while punchline fills it in.                                                                                                                                                                                  |
| Host permission `https://api.harvestapp.com/*`                       | Reads the user's own Harvest user record and time entries with the personal access token they entered, to add up hours per day.                                                                                                                                                                                 |
| Host permissions `https://hrworks.de/*` and `https://*.hrworks.de/*` | The content script reads the HRworks working-time page to compare existing entries and fills in the times the user confirmed. HRworks serves each customer from its own subdomain (for example ssl1.hrworks.de), so the extension can't know the exact host in advance. It does nothing on other HRworks pages. |
| Content script and web accessible resource                           | The content script is what reads and fills the HRworks page. `days/days.html` is web accessible on HRworks only, for the optional overlay that shows the preview inside the HRworks tab instead of the side panel.                                                                                              |

**Remote code:** No, I am not using remote code. All JavaScript is bundled in the package.

**Data usage**, collected or handled:

- [x] Personally identifiable information (the Harvest user record: name and user ID)
- [x] Authentication information (the Harvest personal access token)
- [x] Website content (working times read from the HRworks page)
- [ ] Everything else unticked

**Certifications:** tick all three (not sold to third parties, not used for purposes unrelated
to the single purpose, not used for creditworthiness or lending).

**Privacy policy URL:**
`https://github.com/gruesomeparty/punchline/blob/main/docs/privacy-policy.md`

## Optional later: publish from CI

The Chrome Web Store API can upload and submit the zip from the Release workflow. It needs an
OAuth client and refresh token stored as repository secrets, so it's left out until releases
are frequent enough to be worth it.
