# Log in with Harvest (OAuth)

punchline can log in with Harvest instead of a personal access token. It uses Harvest's
client-side OAuth2 flow (`response_type=token`), which needs only a client ID. There is no
client secret, so nothing secret ships in the extension. The personal access token stays
available as a fallback.

The button only shows once `HARVEST_CLIENT_ID` in `src/harvest/oauth.ts` is set.

## How it works

1. **Log in with Harvest** calls `chrome.identity.launchWebAuthFlow` with
   `https://id.getharvest.com/oauth2/authorize?client_id=…&response_type=token&state=…` and
   the redirect `https://<extension-id>.chromiumapp.org/`.
2. Harvest redirects with `access_token`, `expires_in` and `scope=harvest:<account id> …` in the
   URL fragment. punchline checks `state`, stores the token and expiry in
   `chrome.storage.local`, and takes the account ID from the scope.
3. Tokens last 14 days and this flow has no refresh token. Within a day of expiry, punchline
   retries the login without a window. That works while the user is still signed in to Harvest
   ID. Otherwise the settings ask to log in again.

## Maintainer setup

The extension ID is fixed by the public key in `"key"` in `src/manifest.json`:

- Extension ID: `flnlojnobcjpbpihgmmpojipadmpeakl`
- Redirect URL: `https://flnlojnobcjpbpihgmmpojipadmpeakl.chromiumapp.org/`

The matching private key is kept by the maintainer, outside every repository. It's only needed
for the first Chrome Web Store upload: put it in the zip root as `key.pem` so the store keeps
this ID.

1. **Register the OAuth app** at <https://id.getharvest.com/developers> → **Create new OAuth2
   application**:
   - Name: punchline
   - Redirect URL: the one above
   - Multi account: yes
   - Products: Harvest
2. **Set the client ID** in `HARVEST_CLIENT_ID`. Client IDs are public, so it can be committed.
   Never commit the client secret. This flow doesn't use it.
