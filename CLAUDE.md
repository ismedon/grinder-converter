# CLAUDE.md

冲煮手记 / Brew Journal — a bag-centric coffee dial-in journal, with the original grinder-setting converter (Comandante C40 ↔ 1Zpresso K-Ultra ↔ Mahlkönig EK43) demoted to a secondary page. Bilingual (zh primary, en toggle), wabi-sabi visual design, installable local-first PWA — no backend, ever (ADR 0003).

Live: https://ismedon.github.io/grinder-converter/ — the repo name and URL deliberately keep the old converter identity for inbound links (ADR 0001). GitHub Pages deploys from `main`. PRs get an automatic Claude review, and `@claude` mentions work in issues/PRs (`.github/workflows/`).

Read `CONTEXT.md` (Bag/Brew/Dial-in vocabulary, modeling decisions) and `docs/adr/` before product-shaping work. Dated design plans live in `docs/plans/`; user-facing changes are logged in `CHANGELOG.md` (zh, versioned).

## Layout

- `index.html` — the whole app: markup, CSS, and all application JS in the **first** `<script>` block. No build, no framework, no external resources (system font stacks — Google Fonts was removed for offline use).
- A second, tiny `<script>` block at the end holds only PWA wiring (service-worker registration, `navigator.storage.persist()`). It sits outside the first block on purpose — tests never see it.
- `sw.js` — network-first for HTML, cache-first for shell assets; bump `CACHE_VERSION` only when the precache list or icons/manifest change (plain HTML edits propagate without a bump). `manifest.webmanifest`, `icons/` (regenerate via `scripts/generate_icons.py`).
- `reference/` — original PRD and calibration research (see Hard rules).

## Hard rules

- **Anchor data is physical measurement, not code.** The `*_TO_K_POINTS` arrays were calibrated from real-world brewing. Never change the values without explicit user approval. Provenance: the 附录 of `reference/grinder-converter-project.md` (it supersedes the PRD's original ×3.75 coefficient) and `reference/c40-kultra-conversion-research.md`; pinned by `tests/conversion-accuracy.test.mjs`.
- **App code stays in `index.html`, inside the first `<script>` block.** Single-file/no-build is a standing decision (ADRs 0001, 0003), and the test harness executes exactly that block.
- **`var BrewLog` stays `var`.** Tests run the script via `vm.runInContext`, which exposes only `var`/function declarations on the context object — `const`/`let` would break `ctx.BrewLog` in all three test files.
- **Never assign `.innerHTML`.** Build DOM with `el()` and `clearChildren()`.

## Tests

```
node --test tests/*.test.mjs
```

Node built-ins only (`node:test`, `node:vm`). Each of the three test files regex-extracts the first literal `<script>…</script>` pair from `index.html` (the tag must stay attribute-free) and runs it in a VM context over hand-rolled DOM stubs. Consequences:

- Anything outside that first block is invisible to tests.
- The stubs implement only the DOM APIs the app currently uses, and each test file carries its own copy (`makeElementStub()` …). Using a new DOM API in `index.html` means extending the stubs in **all three** files, or every test fails at load.

Preview: open `index.html` directly in a browser — everything works from `file://` except service-worker/install features (those need https or localhost; the canonical install is the Pages URL).

## Orientation

The code is the source of truth; this is the map.

- **Converter** — piecewise-linear interpolation (`interpolatePiecewise`) through the anchor arrays, K-Ultra as hub: `convertValue()` = `toKUltra()` → `fromKUltra()` → clamp to the target's range. Per-direction arrays (C40→K vs K→C40) are intentionally asymmetric. K-Ultra notation `X.Y.Z` = X×100 + Y×10 + Z clicks (`clicksToNotation`). Brew-method suggestions use per-grinder thresholds (`getBrewMethodByC40` / `ByKUltra` / `ByEK43`).
- **Routing** — hash router (`parseRoute`/`applyRoute` → `renderJournal`): `#/` bag-card dashboard, `#/bag/<id>[/<brewId>]` bag timeline (best brew pinned, brews grouped by method, open brew editable), `#/convert` converter; legacy `#/log…` routes fall back to the dashboard. Journal fields are `contenteditable`, saved on focusout via delegated `onEditableBlur`.
- **Storage** — only the `BrewLog` IIFE touches `localStorage`: `grinder-brew-journal-v2` (live store), `grinder-brew-log-v1` (frozen pre-migration backup — read once by the idempotent v1→v2 migration, never written again), and a last-backup timestamp (`STORAGE_KEY_BACKUP`). A Bag's natural key is `bagKey(name, roastDate)`; ids derive from it deterministically, so migration/import re-runs converge on the same ids (ADR 0002). `createBag()` / `createBrew()` are the schema source of truth. Sanitizers return `null` instead of throwing. Import accepts v1 and v2 shapes, merging bags by natural key and brews by `id` (later `createdAt` wins).
- **i18n, two mechanisms** — strings that re-render on language toggle live in `i18n` and flow through `updateTexts()`; journal labels are read fresh each render from `LOG_LABELS` via `logLabels()`. Every user-visible string belongs in one of the two.

## This machine (not the code)

- Moving this folder hides old Claude Code sessions — history lives under `~/.claude/projects/`, keyed by absolute path. Recover: `cp -n` the old dir's `*.jsonl` into the new one.
- It also breaks the `claude agents` dashboard ("working dir doesn't exist") — rewrite `cwd`/`originCwd` in `~/.claude/jobs/<id>/state.json`. `--resume` is unaffected.
