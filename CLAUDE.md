# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coffee grinder setting converter — a single-page web tool that converts grind settings between Comandante C40, 1Zpresso K-Ultra, and Mahlkönig EK43. Bilingual (Chinese/English), wabi-sabi visual design. Deployed via GitHub Pages.

Live: https://ismedon.github.io/grinder-converter/

## Architecture

**Single-file app**: Everything lives in `index.html` — HTML structure, CSS (in `<style>`), and JavaScript (in `<script>`). No build step, no framework, no external JS dependencies. Only external resource is Google Fonts (Noto Serif SC).

### Conversion Engine

Conversions use **piecewise linear interpolation** through calibrated anchor points, with K-Ultra as the hub:
- `Source → K-Ultra → Target` (two-hop via `toKUltra()` → `fromKUltra()`)
- Anchor point arrays: `C40_TO_K_POINTS`, `K_TO_C40_POINTS`, `EK43_TO_K_POINTS`, `K_TO_EK43_POINTS`
- `interpolatePiecewise()` handles the math; results are clamped to target grinder range
- The anchor points are asymmetric (C40→K vs K→C40 are separate arrays) to preserve accuracy in each direction

### K-Ultra Notation

K-Ultra uses X.Y.Z format (rotation.number.tick), where total clicks = X×100 + Y×10 + Z. `clicksToNotation()` converts.

### i18n

`i18n` object with `zh` and `en` keys. `currentLang` state variable. `updateTexts()` pushes translations to DOM elements. All user-visible strings are in the i18n object.

### Design System (Wabi-Sabi)

CSS custom properties in `:root` — warm earth tones with dark mode via `prefers-color-scheme: dark`. Serif headings (Noto Serif SC), muted colors, minimal shadows.

### Brew Journal

The app is a **Bag-centric brew journal** (the converter is a secondary page). A hash router (`parseRoute()`/`applyRoute()`) switches two top-level views — `#journalView` and `#converterView`:

- `#/` (and legacy `#/log`, `#/log/<id>`) → **dashboard**: a grid of bag cards.
- `#/bag/<bagId>[/<brewId>]` → **bag timeline**: editable bag identity header, the best brew pinned, remaining brews grouped by method, and an editable (open) brew card when `<brewId>` is present.
- `#/convert` → the **converter**.

`renderJournal(route)` is the entry point; it dispatches to `renderDashboard` / `renderBagView`. All fields are `contenteditable` with focusout-to-save (delegated `onEditableBlur` on `#journalView`).

- **Storage** (owned entirely by the `BrewLog` IIFE — components never touch `localStorage`):
  - `grinder-brew-journal-v2` (`STORAGE_KEY_V2`, `JOURNAL_VERSION = 2`) — the **live** store: a JSON array of Bags. Read/written via `loadJournal()` / `saveJournal()`.
  - `grinder-brew-log-v1` (`STORAGE_KEY`, `SCHEMA_VERSION = 1`) — the **preserved v1 backup**: read once for migration, never written after.
- **Migration (automatic + idempotent)**: on first `loadJournal()` with no v2 key, `migrateEntriesToBags()` consolidates v1 flat entries into Bags, persists v2, and leaves v1 untouched. Bag ids are deterministic — `bagIdFromKey(bagKey(name, roastDate))` — so re-running migration/import yields the same ids.
- **Schema** (constructors are the source of truth):
  - Bag (`createBag()`): `id`, `schemaVersion: 2`, `createdAt` (ISO), `name`, `origin`, `roastDate` (`YYYY-MM-DD`), `roastLevel`, `grinderModel`, `status` (`'active' | 'finished'`), `brews: [Brew]`
  - Brew (`createBrew()`): `id`, `createdAt` (ISO), `date` (`YYYY-MM-DD`), `weather`, `grinderSetting`, `brew: {method, dripper, waterTempC, dose, yield, totalTimeSec, pourSegments}`, `extraction: {tds, ey}`, `rating` (0–5 int), `flavorNotes`, `reflection`
  - **Natural identity**: a Bag is keyed by `bagKey(name, roastDate)` (trimmed, name lower-cased). Migration and import consolidate/merge by this key.
- **Sanitizers**: `sanitizeBag()` / `sanitizeBrew()` drop malformed input (return `null`) instead of throwing — strip unknown fields, clamp rating to int 0–5, normalize roastLevel, default unknown status to `'active'`, and sanitize nested brews (dropping invalid ones). (`sanitizeEntry()` for v1 entries still exists for the migration path.)
- **Import is shape-agnostic**: `extractBags()` accepts a v2 payload (`{schemaVersion: 2, bags}`), a raw bag array, or any v1 shape (`{schemaVersion: 1, entries}` / raw entry array — migrated to bags). `mergeJournalImport()` merges incoming bags by natural key; within a bag, brews merge by `id` with the later `createdAt` winning. `exportJournal()` wraps bags as `{schemaVersion: 2, exportedAt, bags}`.
- **Best brew**: `bestBrew(bag)` returns the highest-rated brew (latest `createdAt` wins ties), or `null` if none are rated > 0.
- **Converter demotion**: the converter lives at `#/convert`; the open brew card's grind-setting field has an inline "translate" button that jumps to the converter pre-targeted to the bag's grinder (`preselectConverterTarget`).
- **`var BrewLog` is load-bearing for tests** — `vm.runInContext` only attaches `var` and function declarations to the context object. Switching to `const`/`let` would make `ctx.BrewLog` unreachable from the test files.
- **`LOG_LABELS`** is a separate object from `i18n` — per-render journal labels stay in `LOG_LABELS` (read fresh via `logLabels()`); strings that re-label on language switch via `updateTexts()` (incl. the `tabJournal`/`tabConverter` view-switcher labels) live in `i18n`.
- **DOM convention**: never assign to `.innerHTML`. Use `clearChildren(node)` and the `el()` helper. A pre-commit hook on this machine enforces this.

## Commands

### Run tests
```
node --test tests/*.test.mjs
```

Tests use Node.js built-in test runner with `node:test` and `node:vm`. They extract the `<script>` from `index.html` and run it in a sandboxed VM context with DOM stubs, then test the conversion functions directly.

### Preview locally
Open `index.html` directly in a browser — no server needed.

## Key Files

- `index.html` — the entire application
- `tests/conversion-accuracy.test.mjs` — anchor regression, roundtrip consistency, and range-clamping tests
- `tests/brew-log.test.mjs` — v1 entry schema, sanitize, import/export, and corrupt-storage tests (the v1 layer kept for migration/back-compat)
- `tests/journal.test.mjs` — v2 Bag/Brew constructors, natural-key + deterministic id, sanitizers, v1→v2 migration, load/save, both-shape import + merge, best-brew, and routing
- `reference/grinder-converter-project.md` — original PRD with data specs and brew method tables; **see its 附录 (appendix) for the calibration rationale that supersedes the original ×3.75 linear coefficient**
- `reference/c40-kultra-conversion-research.md` — 2026-06 community/source research on C40↔K-Ultra (refutes ×1.5 and ×3.2 single-coefficient formulas; confirms the brew-chart-calibrated piecewise approach is more accurate)
- `docs/plans/` — design plans for the wabi-sabi redesign

## Important Constraints

- **Single-file architecture must be preserved** — all HTML/CSS/JS stays in `index.html`
- **Anchor point data is calibrated from real-world measurements** — do not change conversion values without explicit user approval
- **Tests extract the inline `<script>` via regex** — if you restructure the script tag, tests will break
- **Test DOM stubs are minimal** — if you use a new DOM API (e.g. `setAttribute`, `getAttribute`) in `index.html`, add it to `makeElementStub()` in the test file or all tests will fail
- Brew method thresholds are per-grinder (not just K-Ultra-based) — each grinder has its own `getBrewMethodByX()` function
