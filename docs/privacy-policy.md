# punchline privacy policy

_Last updated: 30 October 2026_

punchline is a Chrome extension that copies your daily working hours from Harvest into the
HRworks working-time page. It runs entirely in your browser. There is no punchline server, no
account, no analytics and no tracking.

## What punchline handles

| Data                                                                               | Where it comes from                    | What it's used for                                        | Where it's kept                        |
| ---------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| Harvest token (personal access token or login token), its expiry, and account ID   | You enter them, or Log in with Harvest | Authenticating your own requests to the Harvest API       | `chrome.storage.local` in your browser |
| Your Harvest user record and time entries                                          | Harvest API (`api.harvestapp.com`)     | Adding up your hours per day                              | In memory while punchline is open      |
| Your HRworks working times                                                         | The HRworks page you're logged in to   | Comparing with Harvest, and writing the times you confirm | In memory, plus the write log below    |
| Write log: dates, times written, and the previous HRworks times before an override | Created by punchline                   | Letting you see and undo what punchline changed           | `chrome.storage.local` in your browser |
| Settings: start time, break rules, theme                                           | You choose them                        | Calculating start and end times                           | `chrome.storage.local` in your browser |

## Where data goes

- Your Harvest token is sent only to `api.harvestapp.com`, as the authentication header of
  requests for your own data. It is never sent anywhere else and never logged.
- Your hours per day and the calculated start and end times are shown on the HRworks page in
  your browser, as punchline's badges. The token itself never reaches the HRworks page.
- Working times are written only to the HRworks page in your own logged-in browser session.
  punchline never sees or stores your HRworks password or session cookies.
- Nothing is sent to the developer or to any third party. punchline doesn't sell data, doesn't
  use it for advertising, and doesn't use it to decide creditworthiness or for lending.

## Retention and deletion

Everything punchline stores stays in your browser until you remove it. Clearing the token in the
settings removes it. Removing the extension from `chrome://extensions` deletes all of its stored
data.

## Permissions

- `storage`: keeps your settings and write log in your browser.
- `sidePanel`: shows the optional list view in Chrome's side panel next to HRworks.
- `identity`: opens Harvest's own login page for "Log in with Harvest" and receives the token
  from it. punchline never sees your Harvest password.
- Host access to `api.harvestapp.com`: reads your Harvest time entries.
- Host access to `hrworks.de` and `*.hrworks.de`: reads the HRworks working-time page, shows
  punchline's badges on it and fills in the times you confirm.
  HRworks serves each customer from its own subdomain, so the wildcard is needed.

## Changes

Changes to this policy are made in this file, and its history is public in the
[repository](https://github.com/gruesomeparty/punchline/commits/main/docs/privacy-policy.md).

## Contact

Questions: open an [issue](https://github.com/gruesomeparty/punchline/issues). Security
problems: report them privately as described in [SECURITY.md](../SECURITY.md).
