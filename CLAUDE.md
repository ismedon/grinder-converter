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

### Brew Log

Hash router (`#/`, `#/log`, `#/log/<id>`) toggles between the converter and the brew journal. The journal renders a two-page spread (params on the left, prose on the right), all fields are `contenteditable` with blur-to-save.

- **Storage**: localStorage key `grinder-brew-log-v1` holds a JSON array of entries. The `BrewLog` IIFE owns all read/write paths — components never touch `localStorage` directly.
- **Schema** (`BrewLog.createEntry()` is the source of truth):
  - Top-level: `id`, `schemaVersion`, `createdAt` (ISO), `date` (`YYYY-MM-DD`), `weather`, `rating` (0–5 int), `flavorNotes`, `reflection`
  - `beans`: `name`, `origin`, `roastDate`, `roastLevel`
  - `grinder`: `model`, `setting`
  - `brew`: `method`, `dripper`, `waterTempC`, `dose`, `yield`, `totalTimeSec`, `pourSegments`
  - `extraction`: `tds`, `ey`
- **Sanitizer**: `sanitizeEntry()` drops malformed input (returns `null`) instead of throwing. Unknown fields are stripped; rating is clamped to integer 0–5.
- **Import merge**: `mergeImport()` keys by `id`; on collision the entry with the later `createdAt` wins.
- **`var BrewLog` is load-bearing for tests** — `vm.runInContext` only attaches `var` and function declarations to the context object. Switching to `const`/`let` would make `ctx.BrewLog` unreachable from `tests/brew-log.test.mjs`.
- **`LOG_LABELS`** is a separate object from `i18n` — labels that need to update on language switch via `updateTexts()` belong in `i18n`; per-render log labels stay in `LOG_LABELS` and are read fresh through `logLabels()`.
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
- `tests/brew-log.test.mjs` — schema, sanitize, import/export, and corrupt-storage tests for the brew journal
- `reference/grinder-converter-project.md` — original PRD with data specs and brew method tables
- `docs/plans/` — design plans for the wabi-sabi redesign

## Important Constraints

- **Single-file architecture must be preserved** — all HTML/CSS/JS stays in `index.html`
- **Anchor point data is calibrated from real-world measurements** — do not change conversion values without explicit user approval
- **Tests extract the inline `<script>` via regex** — if you restructure the script tag, tests will break
- **Test DOM stubs are minimal** — if you use a new DOM API (e.g. `setAttribute`, `getAttribute`) in `index.html`, add it to `makeElementStub()` in the test file or all tests will fail
- Brew method thresholds are per-grinder (not just K-Ultra-based) — each grinder has its own `getBrewMethodByX()` function
