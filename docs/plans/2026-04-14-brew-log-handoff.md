# Brew Log feature — handoff to next session

**Status**: 6/8 stages shipped as commits on `feature/brew-log`. Stages 7–8 remain.
Branch is **not pushed yet** (per user: commit in stages, push only when done).

## Context (carry-over)

User approved the full plan in a previous session using plan mode. The frozen plan
lives at `/Users/donlai/.claude/plans/vast-foraging-wind.md` — read it for rationale
on data schema, UI shape, and non-goals. Key user preferences from this session:

- **Stage commits, single push at end, then PR** — don't push mid-flight.
- **Code-reviewer agent runs first**, user reviews after. Don't self-declare "done"
  until stage 8 passes.
- **Single-file architecture is a hard rule**: everything stays in `index.html`.
  Tests extract the inline `<script>` via regex (`tests/conversion-accuracy.test.mjs`).

## What's shipped (commits on `feature/brew-log`)

Read `git log main..feature/brew-log` for the series. Each stage = one commit:

| # | Commit subject | Scope |
|---|---|---|
| 1 | data layer for brew journal | `BrewLog` namespace: create / load / save / mergeImport / exportPayload / sanitizeEntry. localStorage key `grinder-brew-log-v1`. |
| 2 | hash router and view-switcher tabs | `#/`, `#/log`, `#/log/<id>` with `hashchange`; `换算｜日志` tab nav. |
| 3 | two-page spread, pager, toolbar actions | Read-only render + working new/import/export/discard/pager. |
| 4 | editing, rating, keyboard shortcuts | contenteditable with blur-save, ←/→ pager, N new, star rating (click same star again = clear). |
| 5 | paper spread, handwriting fonts, dots | Caveat + Ma Shan Zheng via Google Fonts; SVG noise texture; ruled prose lines. |
| 6 | wire i18n for tabs + record-this-brew link | `换算/日志` + `记录这次冲煮 →` follow lang switch; lang switch re-renders log view. |

## What's left

### Stage 7 — tests + docs (still pending)

Create `tests/brew-log.test.mjs` using the same `node:test` + `node:vm` pattern as
`conversion-accuracy.test.mjs`. The VM loader in that file is the canonical way to
access the inline script — copy its `loadConverterContext()` idea. `BrewLog` is
declared as `var`, so `ctx.BrewLog` is reachable.

Required tests (from the plan):
1. `BrewLog.createEntry()` returns all schema fields with sane defaults.
2. Export → import roundtrip preserves every entry.
3. Import merges by `id`; on collision keeps the later `createdAt`.
4. `sanitizeEntry` drops malformed input instead of throwing (null, string, missing `id`).
5. `load()` on corrupt JSON returns `{ entries: [], corrupt: true }` — stub `localStorage`
   in the vm context to return bad JSON; the script already guards
   `typeof localStorage !== 'undefined'`.

Docs:
- `CHANGELOG.md` — add a `v2.1.0` entry describing the journal feature.
- `CLAUDE.md` — add a short section documenting the `grinder-brew-log-v1` localStorage
  key, the entry schema, and note that `var BrewLog` must stay reachable from the
  VM context (tests depend on it).

DOM stub work: `tests/conversion-accuracy.test.mjs` was already extended this session
(added `toggle`, `contains`, `hidden`, `dataset`, `createElement`, `body`,
`document.addEventListener`). If the new tests need anything more, extend there.

### Stage 8 — self-review + manual browser test

1. Launch `feature-dev:code-reviewer` (or `pr-review-toolkit:code-reviewer`) against
   the diff `main..feature/brew-log`. Fix high-severity items only; don't scope-creep.
2. Manual browser pass — open `index.html` directly (no server needed) and walk the
   checklist from the original plan:
   - Converter still works (regression).
   - `日志` tab → empty state → `+ 新建一篇` → blank spread appears.
   - Type in every field → refresh page → values persisted.
   - Create a second entry → pager works via button + ←/→.
   - Rating ✦/✧ toggles on click.
   - Viewport < 900px stacks left/right pages vertically.
   - Export downloads JSON; clear localStorage; import restores entries.
   - Dark mode (toggle OS setting) looks right.
   - Chinese ↔ English switch re-renders the journal labels.
3. After the user signs off manually, do the push + PR:
   ```
   git push -u origin feature/brew-log
   gh pr create --title "feat: 新增冲煮日志功能" --body "..."
   ```

## Gotchas and non-obvious decisions

- **Stage 3 already shipped import/export/new/discard click handlers.** These were
  pulled forward from stage 4's original scope because the UI would have been dead
  without them. Stage 4 added contenteditable, rating clicks, and keyboard shortcuts
  on top.
- **`BrewLog` is declared with `var`**, not `const`. This is load-bearing: the tests
  use `vm.runInContext`, where only `var` and function declarations attach to the
  context object. `const`/`let` would be unreachable from `ctx.BrewLog`.
- **There is a pre-commit hook that blocks assigning to the `.inner` + `HTML` DOM
  property on this machine** (both in code AND in prose — even the word triggers
  the check). Use `clearChildren(node)` (already defined) instead. The `el()`
  helper intentionally does not accept a raw-markup option.
- **Date field has dual display**: stored as ISO `2026-04-14`, rendered via
  `formatLogDate()` as `2026年04月14日 周一` (zh) or `April 14, 2026 · Monday` (en).
  On focus, the editable span swaps to ISO for editing; on blur, invalid input is
  rejected (keeps previous value) and display reformats.
- **`LOG_LABELS` lives next to `i18n` but is a separate object.** i18n entries that
  need to sync on lang-switch (`tabConverter`, `tabLog`, `recordThisBrew`) went into
  the main `i18n` object and flow through `updateTexts()`. Log-view-internal labels
  stay in `LOG_LABELS` and are resolved per-render via `logLabels()` reading
  `currentLang`. Keeps both groups small.
- **Rating click re-renders the whole log view** via `applyRoute()`. That's a
  deliberate simplification — star state is cheap to redraw, and it avoids a second
  "patch just this element" code path. Field edits do **not** re-render (they
  mutate textContent in place) so caret position survives.
- **Keyboard handler is on `document`**, gated by `logView.hidden`. It respects
  `isContentEditable`/`INPUT`/`TEXTAREA` so typing "n" in a field doesn't create a
  new entry. Enter collapses single-line fields (blurs them); prose fields keep
  Enter for newlines.

## Commands

```bash
# Run tests
node --test tests/
# or just the new file when stage 7 is in place
node --test tests/brew-log.test.mjs

# Preview
open index.html    # or python3 -m http.server 8000
```

## Task tracker IDs

Tasks 1–6 marked completed. Tasks 7 and 8 remain pending — use `TaskList` to resume.
