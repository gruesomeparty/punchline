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

1. **Give the extension a stable ID.** The redirect URL contains the extension ID, and an
   unpacked extension's ID depends on its folder. Add the public key as `"key"` in
   `src/manifest.json`. Either copy it from the Chrome Web Store item (Package → Public key) or
   generate a key pair locally and keep the private key out of every repository.
2. **Register the OAuth app** at <https://id.getharvest.com/developers>:
   - Name: punchline
   - Redirect URL: `https://<extension-id>.chromiumapp.org/` (from `chrome://extensions`)
   - Multi account: yes, if people have more than one Harvest account
   - Products: Harvest only
3. **Set the client ID** in `HARVEST_CLIENT_ID`. Client IDs are public, so it can be committed.
   Never commit the client secret. This flow doesn't use it.
