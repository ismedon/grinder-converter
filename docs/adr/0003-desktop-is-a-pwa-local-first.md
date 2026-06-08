# Desktop target is a hardened PWA, not a native wrapper; data stays local-first

The user wants to run the tool on a MacBook "like an app" and, above all, keep brew records stored locally — explicitly to replace a paper notebook. The app is already an installable PWA (manifest, service worker, `display: standalone`), so on macOS it can be added to the dock and run offline today. We choose to **harden the PWA** rather than wrap it in Tauri/Electron, and to deliver data ownership through **persisted local storage (`navigator.storage.persist()`) plus one-click JSON file export/import** — with no backend, ever.

## Considered options

- **Tauri wrapper** auto-writing a real `~/Documents/brew-journal.json` — rejected *for now*: most notebook-faithful, but it adds a Rust build toolchain + code signing/notarization, breaking the no-build constraint. Kept as a future option (it would wrap the same web code, not a rewrite).
- **Electron** — rejected: bundles Chromium (~100MB+), overkill for this tool.

## Consequences

- Records already live only on the user's machine; GitHub Pages serves the program and never receives data. The "local" requirement is met without native code.
- The installed-app experience (service worker, add-to-dock, offline) requires the **HTTPS Pages URL or `localhost`** — it does **not** work from a `file://` double-click. Install once from the Pages URL; thereafter it launches from the dock offline. Double-click-to-open stays a dev convenience.
- Backup is a deliberate user action (Export), not automatic sync; a "last backed up" indicator mitigates silent lapses. If automatic, browser-independent, synced file storage becomes a felt need, revisit Tauri.
- For full offline use the redesign must remove the network font dependency (Google Fonts) in favour of system/self-hosted fonts, and `sw.js` must cache the complete page.
- Single-file / no-build / existing repo + URL are all preserved.
