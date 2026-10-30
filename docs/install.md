# Installing punchline

punchline is free and installs from a zip file. It takes about five minutes. You need Google
Chrome (or another Chromium browser such as Edge, Brave or Arc), a Harvest account and an
HRworks login.

## 1. Download

1. Open the [latest release](https://github.com/gruesomeparty/punchline/releases/latest).
2. Under **Assets**, download `punchline-<version>.zip`.

## 2. Unzip to a folder you keep

Unzip it into a folder that stays put, for example `Documents/punchline`. Chrome loads the
extension from this folder every time it starts, so don't leave it in Downloads and don't
delete it.

On a Mac, double-click the zip, then move the new folder to `Documents` and rename it to
`punchline`. On Windows, right-click the zip, choose **Extract All…**, and pick
`Documents\punchline`.

## 3. Load it in Chrome

1. Go to `chrome://extensions` (type it in the address bar).
2. Turn on **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `punchline` folder. Pick the folder that contains
   `manifest.json`, not a folder above it.
4. Click the puzzle icon in the toolbar and pin punchline, so its icon stays visible.

Developer mode is needed for any extension that doesn't come from the Chrome Web Store. Chrome
may remind you about it now and then. Leave it on.

## 4. Connect Harvest

1. Click the punchline icon, then **Settings**.
2. In Harvest, open [Developers → Personal Access Tokens](https://id.getharvest.com/developers)
   and create a token.
3. Copy the **token** and the **Account ID** into punchline's settings and click **Test
   connection**.
4. Check the start time and break rules (Switzerland or Germany).

Your token stays in your browser and is only sent to Harvest. See the
[privacy policy](privacy-policy.md).

## 5. Use it

Open HRworks **Arbeitszeiten** and stay logged in. Click the punchline icon, pick your dates and
check the preview before you write anything.

## Updating

1. Download the new zip from the [latest release](https://github.com/gruesomeparty/punchline/releases/latest).
2. Replace the contents of your `punchline` folder with the new files. Use the same folder,
   so Chrome keeps your settings.
3. On `chrome://extensions`, click the reload arrow on the punchline card.

Watch the repository (**Watch → Custom → Releases**) on GitHub to get an email for new
versions.

## Uninstalling

Click **Remove** on the punchline card in `chrome://extensions`, then delete the folder.
Removing it also deletes your saved token and settings.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Manifest file is missing or unreadable" | You picked the wrong folder. Select the one that directly contains `manifest.json`. |
| punchline is gone after a restart | The folder was moved or deleted. Unzip again and load it again. |
| Settings are empty after an update | You loaded a different folder. Remove that copy and load the original folder. |
| Test connection fails | Check the token and Account ID in Harvest. A token copied with spaces fails. |
| Preview says "Open HRworks Arbeitszeiten in a tab." | Open HRworks, log in and go to Arbeitszeiten. |
| Your company blocks Developer mode | Ask IT to allow it, or wait for the Chrome Web Store version. |

## For AI assistants helping someone install

If a user asks you (for example Claude) to install punchline for them, follow these steps. They
assume a shell on the user's computer. Chrome doesn't let programs add unpacked extensions on
their own, so the user always does step 3 themselves.

1. **Download and verify the latest release** into a folder the user keeps:

   ```sh
   # macOS / Linux
   dest="$HOME/Documents/punchline"
   tmp="$(mktemp -d)"
   base="https://github.com/gruesomeparty/punchline/releases/latest/download"
   tag="$(curl -fsSL -o /dev/null -w '%{url_effective}' https://github.com/gruesomeparty/punchline/releases/latest)"
   version="${tag##*/v}"
   curl -fsSLo "$tmp/punchline.zip" "$base/punchline-$version.zip"
   curl -fsSLo "$tmp/SHA256SUMS.txt" "$base/SHA256SUMS.txt"
   expected="$(awk '{print $1}' "$tmp/SHA256SUMS.txt")"
   actual="$( (command -v sha256sum >/dev/null && sha256sum "$tmp/punchline.zip" || shasum -a 256 "$tmp/punchline.zip") | awk '{print $1}')"
   [ "$expected" = "$actual" ] || { echo "checksum mismatch, stop"; exit 1; }
   mkdir -p "$dest"
   unzip -oq "$tmp/punchline.zip" -d "$dest"
   test -f "$dest/manifest.json" && echo "punchline $version is in $dest"
   ```

   ```powershell
   # Windows PowerShell
   $dest = "$env:USERPROFILE\Documents\punchline"
   $release = Invoke-RestMethod https://api.github.com/repos/gruesomeparty/punchline/releases/latest
   $zip = $release.assets | Where-Object name -like 'punchline-*.zip'
   $sums = $release.assets | Where-Object name -eq 'SHA256SUMS.txt'
   $tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ([guid]::NewGuid()))
   Invoke-WebRequest $zip.browser_download_url -OutFile "$tmp\punchline.zip"
   Invoke-WebRequest $sums.browser_download_url -OutFile "$tmp\SHA256SUMS.txt"
   $expected = (Get-Content "$tmp\SHA256SUMS.txt").Split(' ')[0]
   $actual = (Get-FileHash "$tmp\punchline.zip" -Algorithm SHA256).Hash.ToLower()
   if ($expected -ne $actual) { throw 'checksum mismatch, stop' }
   Expand-Archive "$tmp\punchline.zip" -DestinationPath $dest -Force
   ```

   For an update, run the same commands. Unzipping over the same folder keeps the user's
   settings.

2. **Open the extensions page** for the user: `open -a "Google Chrome" "chrome://extensions"`
   on macOS, or ask them to type `chrome://extensions` into the address bar.

3. **Walk the user through it**: turn on Developer mode, click Load unpacked, choose the folder
   from step 1 (tell them the full path), pin the icon. For an update, they click the reload
   arrow on the punchline card instead.

4. **Point them to the settings** for the Harvest token and Account ID (section 4 above).
   Never ask the user to paste their Harvest token into the chat, and never write it to a
   file. They enter it in punchline's settings page themselves.

Don't change Chrome policies, preference files or command-line flags to force-install the
extension. Only download the zip from this repository's GitHub Releases.
