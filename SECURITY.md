# Security policy

punchline handles Harvest API tokens and HRworks sessions, so we take security reports seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately via
[GitHub private vulnerability reporting](https://github.com/gruesomeparty/punchline/security/advisories/new)
(repository → _Security_ → _Report a vulnerability_).

Please include:

- what is affected and how it can be exploited,
- steps to reproduce or a proof of concept,
- your suggested fix, if you have one.

**Never include real tokens, cookies, HAR files or screenshots with personal data.** Redact them.

You can expect an acknowledgement within a week. We'll keep you updated and credit you in the
advisory unless you prefer otherwise.

## Supported versions

Only the latest version on `main` receives security fixes.

## Leaked a secret?

If a token was committed or shared by accident, **revoke it immediately** (Harvest: _Developers →
Personal access tokens_). Removing it from git history is not enough.
