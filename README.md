# DeepSeek Harness Desktop (Local Edition)

A **fully self-contained** macOS desktop app for DeepSeek Harness (the `@deepseek-ai/dsh`
npm package): the Node.js runtime and the complete dsh backend are bundled inside the
`.app`, so it runs locally with zero external dependencies — double-click and go.

> **Disclaimer**: the app shell is a third-party wrapper, not official DeepSeek
> packaging. It is provided for testing purposes only.

## Features

- **Self-contained**: `vendor/node` (Node.js v24 runtime) + `vendor/dsh` (the full
  dsh runtime, ~330MB) are bundled. No system-wide node / dsh / npm required.
- **LAN mode (phone/iPad access)**: menu "Mobile Access" → "LAN Mode". The backend
  is patched to bind `0.0.0.0` (the official CLI deliberately blocks this for safety),
  and a popup shows the LAN URL + QR code. Phone/iPad on the same Wi-Fi can open the
  UI in a browser. A clear security warning is shown — turn it off when done.
- **System fallback**: if the bundled files are missing (e.g. dev mode), it falls back
  to system node / dsh.
- **Data isolation**: data still lives in `~/.dsh` (override with `DSH_HOME`).

## Structure

```
dsh-desktop/
├── main.js              # Electron main: runtime resolution, backend boot, UI
├── package.json
├── vendor/
│   ├── node/node        # bundled Node runtime
│   └── dsh/             # bundled dsh runtime
├── lan.html             # LAN-mode popup (URL + QR code)
├── preload.js           # minimal IPC bridge for the LAN popup
├── qrcode.js            # QR generator (vendored)
├── build/               # icons (DeepSeek whale)
├── loading.html         # startup page
├── error.html           # error page
└── dist/                # distributable DMG / ZIP
```

## Usage

### Run the packaged app

```bash
open "dist/DeepSeek Harness-0.2.3-macOS-arm64.dmg"
```

### Dev mode (needs system node + global dsh)

```bash
npm install
npm start            # electron .
```

### Self-check

```bash
npm run resolve      # prints runtime resolution (bundled / system / none) and exits
```

## Build & sign

> ⚠️ **Signing pitfall (iCloud)**: this workspace lives under `~/Documents`
> (iCloud-synced), which stamps files with `com.apple.provenance` /
> `com.apple.FinderInfo` attributes. `codesign` refuses to sign files carrying them,
> producing an app with a broken outer signature → users see "app is damaged".
> **Build and sign outside the iCloud-synced folder** (e.g. `/tmp`):

```bash
rm -rf /tmp/build && mkdir -p /tmp/build
cp -R "DeepSeek Harness 本地版.app" /tmp/build/
cd /tmp/build
xattr -cr "DeepSeek Harness 本地版.app"
codesign --force --deep --sign - "DeepSeek Harness 本地版.app"
codesign --verify --deep --strict "DeepSeek Harness 本地版.app"   # must print OK
```

When building the DMG, `hdiutil makehybrid` adds `com.apple.FinderInfo` to files
inside the volume — mount the raw image read-write, run `xattr -cr` on the app,
then `hdiutil convert` to UDZO. Always verify with
`codesign --verify --deep --strict` afterwards.

## Troubleshooting

- **"dsh runtime not found"**: bundled `vendor/` is missing and no system dsh exists;
  rebuild or run `npm install -g @deepseek-ai/dsh` first.
- **Backend exits**: the error page shows the exit code; run
  `DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness --resolve` for diagnostics.
- **Gatekeeper on first launch**: right-click → Open (ad-hoc signed, not notarized).
  If "damaged": `xattr -cr "/Applications/DeepSeek Harness.app"`.
