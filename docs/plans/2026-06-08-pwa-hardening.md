# PWA Hardening Implementation Plan (ADR 0003)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the brew journal fully usable offline as an installed PWA and give the user a visible signal of when they last backed up — delivering the work ADR 0003 commits to.

**Architecture:** Three independent streams against the existing single-file app: (1) remove the Google Fonts network dependency in favour of a system serif stack so the page renders with zero network calls; (2) request persistent storage via `navigator.storage.persist()` so the browser won't silently evict the local journal; (3) record the last-export time and surface a "last backed up" line on the dashboard. All logic that touches `localStorage` stays inside the `BrewLog` IIFE per the project's storage-ownership rule; pure helpers are unit-tested in the VM harness.

**Tech Stack:** Vanilla HTML/CSS/JS in `index.html`, `sw.js` service worker, Node built-in test runner (`node:test` + `node:vm`).

> **Line numbers** below are relative to `index.html` on the `feat/brew-journal-reposition` branch at planning time (2026-06-08). Treat them as anchors — confirm the quoted surrounding code before editing, since edits in earlier tasks shift later line numbers.

---

## Decisions locked (from brainstorm + ADR 0003)

- **Fonts:** System serif stack, no web fonts. `--font-serif` becomes `'Songti SC', 'Noto Serif CJK SC', Georgia, 'Times New Roman', serif`. Handwriting fonts (`--font-hand`, already unused) are removed.
- **Persistent storage:** Call `navigator.storage.persist()` silently on load, feature-guarded. No prompt UI.
- **Backup indicator:** Timestamp only. Store last-export ISO time in a dedicated `localStorage` key; render `Last backed up · <N days ago>` on the dashboard. No stale-warning nudge.

## File Structure

- `index.html` — the whole app. Touched in three regions:
  - `<head>` (lines ~34–37): remove Google Fonts `<link>`/`<preconnect>` tags.
  - `:root` CSS (lines ~53–56): rewrite `--font-serif`, delete `--font-hand`.
  - `BrewLog` IIFE (~1310–1598): add `STORAGE_KEY_BACKUP`, `getLastBackupAt()`, `setLastBackupAt()`, expose in the public API.
  - Component layer: add `relativeDays()` pure helper (~after `formatRoastDate`, line 1715); wire indicator into `renderDashboard` (line 1766) and `onExportJournal` (line 1822); add labels to `LOG_LABELS` (line 1645).
  - Second `<script>` block (~2309–2316): add the `persist()` call. **Not extracted by tests** (regex grabs only the first `<script>`).
- `sw.js` — remove font-cache machinery, bump `CACHE_VERSION`.
- `tests/journal.test.mjs` — add tests for `getLastBackupAt`/`setLastBackupAt` roundtrip and `relativeDays`.

**Test reachability note:** `vm.runInContext` attaches only top-level `var` and `function` declarations to the context. `relativeDays` must be a top-level `function relativeDays(...) {}` (sibling of `parseRoute`, which tests already reach as `ctx.parseRoute`). `getLastBackupAt`/`setLastBackupAt` live inside `BrewLog` and are reached via `ctx.BrewLog.*`.

---

### Task 1: Remove Google Fonts → system serif stack

**Files:**
- Modify: `index.html:34-37` (head font tags), `index.html:53-56` (font CSS vars)
- Modify: `sw.js` (font cache removal + version bump)

This task changes only markup/CSS and the service worker, neither of which is unit-tested. There is no failing test to write; correctness is verified by grep + the full existing suite still passing + a manual offline check.

- [ ] **Step 1: Remove the Google Fonts tags from `<head>`**

Delete these four lines (`index.html:34-37`):

```html
  <!-- Google Fonts: Noto Serif SC (UI/labels) + Caveat & Ma Shan Zheng (handwritten input) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@600;700&display=swap" rel="stylesheet">
```

(Leave the surrounding `<!-- Icons -->` block and PWA meta tags untouched.)

- [ ] **Step 2: Rewrite the font CSS variables**

Replace `index.html:53-56`:

```css
      --font-serif: "Noto Serif SC", "Songti SC", "SimSun", serif;
      /* handwriting fonts unused after the journal reposition; removed together
         with the Google Fonts <link> in the PWA-hardening plan (ADR 0003) */
      --font-hand: "Caveat", "Ma Shan Zheng", "Kaiti SC", "KaiTi", serif;
```

with (no web fonts; `--font-hand` deleted — it has no remaining references):

```css
      --font-serif: "Songti SC", "Noto Serif CJK SC", Georgia, "Times New Roman", serif;
```

- [ ] **Step 3: Strip font caching from the service worker**

In `sw.js`: (a) bump the version, (b) delete the `FONT_CACHE` constant, the `isFontRequest` function, the `staleWhileRevalidate` function, the font branch in the `fetch` handler, and the `FONT_CACHE` reference in the `activate` cleanup filter.

Change line 19:

```js
const CACHE_VERSION = 'v2-2026-06-06';
```

to:

```js
const CACHE_VERSION = 'v3-2026-06-08';
```

Delete line 21:

```js
const FONT_CACHE = `grinder-fonts-${CACHE_VERSION}`;
```

In the `activate` handler, change the filter (line 46) from:

```js
        .filter((k) => k !== APP_CACHE && k !== FONT_CACHE)
```

to:

```js
        .filter((k) => k !== APP_CACHE)
```

Delete the `isFontRequest` function (lines 52-55) and the `staleWhileRevalidate` function (lines 89-99). In the `fetch` handler, delete the font branch (lines 107-110):

```js
  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }
```

Also remove the "Google Fonts CSS + WOFF2" bullet from the strategy comment at the top (lines 9-10).

- [ ] **Step 4: Verify no network-font references remain**

Run: `grep -nE "fonts.googleapis|fonts.gstatic|font-hand|Caveat|Ma Shan|FONT_CACHE|isFontRequest|staleWhileRevalidate" index.html sw.js`
Expected: no output (exit code 1).

- [ ] **Step 5: Run the full suite to confirm nothing broke**

Run: `node --test tests/*.test.mjs`
Expected: all tests pass (CSS/SW changes are invisible to the VM harness, so this is a regression guard).

- [ ] **Step 6: Manual offline check**

Open `index.html` in a browser, open DevTools → Network, hard-reload. Confirm there are **no requests to `fonts.googleapis.com` / `fonts.gstatic.com`** and headings still render in a serif face.

- [ ] **Step 7: Commit**

```bash
git add index.html sw.js
git commit -m "feat(pwa): drop Google Fonts for a system serif stack (ADR 0003)"
```

---

### Task 2: `BrewLog` last-backup timestamp storage

**Files:**
- Modify: `index.html` — `BrewLog` IIFE (add key + accessors near `STORAGE_KEY_V2` at line 1310; export in the API object at line 1593)
- Test: `tests/journal.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add to `tests/journal.test.mjs`:

```js
test("getLastBackupAt returns null when never set", () => {
  const ctx = loadContext({ localStorage: makeLocalStorage() });
  assert.equal(ctx.BrewLog.getLastBackupAt(), null);
});

test("setLastBackupAt then getLastBackupAt roundtrips the ISO string", () => {
  const ls = makeLocalStorage();
  const ctx = loadContext({ localStorage: ls });
  ctx.BrewLog.setLastBackupAt("2026-06-08T10:00:00.000Z");
  assert.equal(ctx.BrewLog.getLastBackupAt(), "2026-06-08T10:00:00.000Z");
  // persisted under its own key, not mixed into the journal store
  assert.equal(ls.getItem("grinder-brew-backup-v1"), "2026-06-08T10:00:00.000Z");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/journal.test.mjs`
Expected: FAIL — `ctx.BrewLog.getLastBackupAt is not a function`.

- [ ] **Step 3: Add the storage key and accessors**

In the `BrewLog` IIFE, immediately after the `STORAGE_KEY_V2` declaration (`index.html:1310`), add:

```js
      const STORAGE_KEY_BACKUP = 'grinder-brew-backup-v1';

      function getLastBackupAt() {
        try {
          return (typeof localStorage !== 'undefined')
            ? localStorage.getItem(STORAGE_KEY_BACKUP) : null;
        } catch (e) {
          return null;
        }
      }

      function setLastBackupAt(iso) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_BACKUP, String(iso));
          }
        } catch (e) { /* storage unavailable — non-fatal */ }
      }
```

- [ ] **Step 4: Expose them in the public API**

In the returned API object (`index.html:1593`, alongside `exportJournal`), add the two functions:

```js
        exportJournal,
        getLastBackupAt,
        setLastBackupAt,
        extractBags,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/journal.test.mjs`
Expected: PASS (both new tests green, no regressions).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/journal.test.mjs
git commit -m "feat(journal): persist last-backup timestamp in BrewLog"
```

---

### Task 3: `relativeDays` pure helper

**Files:**
- Modify: `index.html` — add a top-level function after `formatRoastDate` (line 1715)
- Test: `tests/journal.test.mjs`

`relativeDays(iso, nowMs)` returns the whole-day difference between the calendar day of `iso` and `nowMs`. `nowMs` is injected so tests are deterministic. Returns `null` for falsy/invalid input.

- [ ] **Step 1: Write the failing tests**

Add to `tests/journal.test.mjs`:

```js
test("relativeDays returns 0 for the same calendar day", () => {
  const ctx = loadContext();
  const now = Date.parse("2026-06-08T20:00:00.000Z");
  assert.equal(ctx.relativeDays("2026-06-08T01:00:00.000Z", now), 0);
});

test("relativeDays counts whole days elapsed", () => {
  const ctx = loadContext();
  const now = Date.parse("2026-06-08T12:00:00.000Z");
  assert.equal(ctx.relativeDays("2026-06-05T12:00:00.000Z", now), 3);
  assert.equal(ctx.relativeDays("2026-06-07T23:00:00.000Z", now), 1);
});

test("relativeDays returns null for missing or invalid input", () => {
  const ctx = loadContext();
  assert.equal(ctx.relativeDays("", Date.now()), null);
  assert.equal(ctx.relativeDays("not-a-date", Date.now()), null);
  assert.equal(ctx.relativeDays(null, Date.now()), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/journal.test.mjs`
Expected: FAIL — `ctx.relativeDays is not a function`.

- [ ] **Step 3: Implement the helper**

Add immediately after the `formatRoastDate` function (`index.html:1715`), as a top-level `function` declaration so the VM harness can reach it:

```js
    // Whole days between the calendar day of `iso` and `nowMs` (default now).
    // Returns null for falsy/unparseable input. nowMs is injectable for tests.
    function relativeDays(iso, nowMs) {
      if (!iso) return null;
      const then = Date.parse(iso);
      if (Number.isNaN(then)) return null;
      const now = (typeof nowMs === 'number') ? nowMs : Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const startOfDay = (ms) => {
        const d = new Date(ms);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      };
      return Math.max(0, Math.round((startOfDay(now) - startOfDay(then)) / dayMs));
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/journal.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/journal.test.mjs
git commit -m "feat(journal): add relativeDays helper for backup recency"
```

---

### Task 4: Wire the backup indicator into the dashboard and export

**Files:**
- Modify: `index.html` — `LOG_LABELS` (line 1645/1671), a CSS rule, `renderDashboard` (line 1766), `onExportJournal` (line 1822)

This task is integration wiring of the already-tested pieces (Tasks 2 + 3). The rendering path uses the `el()` helper and is exercised manually; the logic it composes is covered by Tasks 2–3 tests.

- [ ] **Step 1: Add labels to `LOG_LABELS` (both languages)**

In the `zh` block (after `importBtn`/`exportBtn`, `index.html:1647`), add:

```js
        lastBackup: (days) => days === 0 ? '上次备份 · 今天' : `上次备份 · ${days} 天前`,
        neverBackedUp: '尚未备份',
```

In the `en` block (after `importBtn`/`exportBtn`, `index.html:1671`), add:

```js
        lastBackup: (days) => days === 0 ? 'Last backed up · today' : `Last backed up · ${days} day${days === 1 ? '' : 's'} ago`,
        neverBackedUp: 'Not backed up yet',
```

- [ ] **Step 2: Add a CSS rule for the indicator**

Add next to the other `.journal-*` rules (e.g. after `.journal-empty-msg` at `index.html:204`):

```css
    .journal-backup-status { color: var(--text-secondary); font-size: 0.8rem; font-family: var(--font-serif); align-self: center; }
```

- [ ] **Step 3: Render the indicator in the dashboard toolbar**

In `renderDashboard` (`index.html:1766`), replace the toolbar block:

```js
      shell.appendChild(el('div', { class: 'journal-toolbar' }, [
        el('div', { class: 'journal-toolbar-group' }, [
          el('button', { class: 'journal-btn primary', type: 'button', text: L.newBag, onclick: onNewBag })
        ]),
        el('div', { class: 'journal-toolbar-group' }, [
          el('button', { class: 'journal-btn', type: 'button', text: L.importBtn, onclick: onImportJournal }),
          el('button', { class: 'journal-btn', type: 'button', text: L.exportBtn, onclick: onExportJournal })
        ])
      ]));
```

with (adds a backup-status line into the export-side group):

```js
      const lastBackup = BrewLog.getLastBackupAt();
      const backupText = lastBackup === null
        ? L.neverBackedUp
        : L.lastBackup(relativeDays(lastBackup) || 0);

      shell.appendChild(el('div', { class: 'journal-toolbar' }, [
        el('div', { class: 'journal-toolbar-group' }, [
          el('button', { class: 'journal-btn primary', type: 'button', text: L.newBag, onclick: onNewBag })
        ]),
        el('div', { class: 'journal-toolbar-group' }, [
          el('span', { class: 'journal-backup-status', text: backupText }),
          el('button', { class: 'journal-btn', type: 'button', text: L.importBtn, onclick: onImportJournal }),
          el('button', { class: 'journal-btn', type: 'button', text: L.exportBtn, onclick: onExportJournal })
        ])
      ]));
```

- [ ] **Step 4: Stamp the timestamp on export**

In `onExportJournal` (`index.html:1822`), after `URL.revokeObjectURL(url);` and before the closing brace, add:

```js
      BrewLog.setLastBackupAt(new Date().toISOString());
```

- [ ] **Step 5: Run the full suite (regression guard)**

Run: `node --test tests/*.test.mjs`
Expected: all pass. (`renderDashboard` isn't unit-tested, but this confirms the new `BrewLog`/helper references resolve and nothing else broke.)

- [ ] **Step 6: Manual check**

Open `index.html`, go to the dashboard. Confirm it shows `Not backed up yet`. Click **Export**, save the file, then reload — confirm it now shows `Last backed up · today`. Switch language and confirm the label localizes.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(journal): show last-backed-up indicator, stamp on export"
```

---

### Task 5: Request persistent storage on load

**Files:**
- Modify: `index.html` — second `<script>` block (the SW-registration script, `index.html:2309-2316`)

Browsers may evict `localStorage` for "best-effort" origins under storage pressure. `navigator.storage.persist()` upgrades the journal to "persistent" so it survives. This code lives in the second `<script>` block, which the test regex does **not** extract, so it never runs in the VM harness — there is no unit test; verification is manual via DevTools.

- [ ] **Step 1: Add the persist request**

In the second `<script>` block, after the service-worker registration `if (...) { ... }` and before `</script>` (`index.html:2316`), add:

```js
    // Ask the browser to keep the local journal from being evicted under
    // storage pressure. Feature-guarded; silent — no permission UI. (ADR 0003)
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persisted()
        .then((already) => already ? true : navigator.storage.persist())
        .catch(() => {});
    }
```

- [ ] **Step 2: Verify tests are unaffected**

Run: `node --test tests/*.test.mjs`
Expected: all pass (second `<script>` is not extracted, so this is purely a guard that the first script is still intact).

- [ ] **Step 3: Manual check**

Serve over `localhost` (e.g. `python3 -m http.server`), open the page, then DevTools → Application → Storage. Confirm storage is reported as **persistent** (or run `await navigator.storage.persisted()` in the console → `true`).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(pwa): request persistent storage to prevent eviction (ADR 0003)"
```

---

## Self-Review

**Spec coverage (against ADR 0003 consequences):**
- "remove the network font dependency (Google Fonts) in favour of system/self-hosted fonts" → Task 1. ✅
- "`sw.js` must cache the complete page" → already true (APP_SHELL precaches `index.html` + icons, HTML is network-first with cache fallback); Task 1 removes the only remaining network asset (fonts), so the page is fully self-contained offline. ✅
- "persisted local storage (`navigator.storage.persist()`)" → Task 5. ✅
- "a 'last backed up' indicator mitigates silent lapses" → Tasks 2–4. ✅
- "one-click JSON file export/import" → already shipped (`onExportJournal`/`onImportJournal`); Task 4 stamps the time on the existing export. ✅
- "Single-file / no-build preserved" → no build step, no new files except plan doc. ✅

**Placeholder scan:** No TBD/"add error handling"/"similar to"/"write tests for the above" — every code step contains literal code. ✅

**Type/name consistency:** `getLastBackupAt`/`setLastBackupAt` defined (Task 2), exported (Task 2 Step 4), consumed (Task 4 Step 3, Step 4) — names match. `relativeDays(iso, nowMs)` defined (Task 3) and called as `relativeDays(lastBackup)` (Task 4) — signature compatible (`nowMs` optional). `STORAGE_KEY_BACKUP = 'grinder-brew-backup-v1'` matches the literal asserted in the Task 2 test. Labels `lastBackup`/`neverBackedUp` defined in both `zh`/`en` (Task 4 Step 1) and read in `renderDashboard` (Task 4 Step 3). ✅

**Storage-ownership rule:** all `localStorage` access for the new key is inside `BrewLog`; the component layer calls `BrewLog.getLastBackupAt`/`setLastBackupAt`. ✅

**DOM convention:** uses `el()` helper, no `.innerHTML`. ✅ No new DOM API introduced, so `makeElementStub()` needs no changes.
