# Wabi-Sabi Visual Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the grinder converter from generic tool style to Japanese wabi-sabi aesthetic with warm neutral palette, serif headings, and breathing whitespace.

**Architecture:** CSS-only visual changes in a single `index.html` file. Add Google Fonts link for Noto Serif SC. Restructure language switcher HTML from buttons to text links. All JS logic untouched.

**Tech Stack:** HTML/CSS, Google Fonts (Noto Serif SC)

---

### Task 1: Add Google Fonts and update font-family

**Files:**
- Modify: `index.html:8-10` (add font link after SEO meta)
- Modify: `index.html:43-45` (update font-family in body)

**Step 1: Add Google Fonts preconnect and stylesheet link**

In `<head>`, after the Twitter Card meta tags (line ~20), add:

```html
<!-- Google Fonts: Noto Serif SC for headings -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&display=swap" rel="stylesheet">
```

**Step 2: Add serif font variable**

In `:root` CSS variables (line ~25), add:

```css
--font-serif: "Noto Serif SC", "Songti SC", "SimSun", serif;
```

**Step 3: Verify**

Open `index.html` in browser. The page should still look the same (serif font not applied to any element yet). Confirm no console errors from font loading.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add Noto Serif SC font from Google Fonts"
```

---

### Task 2: Update CSS color variables (light mode)

**Files:**
- Modify: `index.html:25-34` (`:root` CSS variables)

**Step 1: Replace all `:root` color variables**

Change the existing `:root` block from:

```css
:root {
  --bg-color: #fafafa;
  --card-bg: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent-color: #2563eb;
  --border-color: #e5e5e5;
  --success-color: #16a34a;
  --warning-color: #d97706;
}
```

To:

```css
:root {
  --bg-color: #f5f0e8;
  --card-bg: #faf8f4;
  --text-primary: #2d2a26;
  --text-secondary: #8a8278;
  --accent-color: #6b7c5e;
  --border-color: #e5dfd5;
  --success-color: #c45c3c;
  --warning-color: #8a7440;
  --font-serif: "Noto Serif SC", "Songti SC", "SimSun", serif;
}
```

Note: `--success-color` is now the wabi-sabi red-clay (赤土), used for the result value. `--accent-color` is matcha green for interactive elements.

**Step 2: Verify**

Open in browser. Background should be warm paper-white, text should be ink-brown, borders should be warm gray. The overall feel should be noticeably warmer.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: apply wabi-sabi light mode color palette"
```

---

### Task 3: Update CSS color variables (dark mode)

**Files:**
- Modify: `index.html:363-391` (dark mode media query)

**Step 1: Replace dark mode color variables**

Change the dark mode `:root` override from:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #0f0f0f;
    --card-bg: #1a1a1a;
    --text-primary: #e5e5e5;
    --text-secondary: #999999;
    --accent-color: #3b82f6;
    --border-color: #333333;
    --success-color: #22c55e;
    --warning-color: #f59e0b;
  }
```

To:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #1a1714;
    --card-bg: #242019;
    --text-primary: #e8e0d4;
    --text-secondary: #9a9287;
    --accent-color: #8a9e7a;
    --border-color: #3a352e;
    --success-color: #d4735c;
    --warning-color: #b8a060;
  }
```

**Step 2: Update dark mode select arrow SVG color**

Change the dark mode `.grinder-select` background-image fill color from `%23999` to `%239a9287` to match the new `--text-secondary`.

**Step 3: Verify**

Toggle system dark mode. Background should be warm dark brown (not pure black), text should be warm off-white.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: apply wabi-sabi dark mode color palette"
```

---

### Task 4: Update typography (headings, card titles, result value)

**Files:**
- Modify: `index.html:94-103` (header styles)
- Modify: `index.html:114-119` (card-title styles)
- Modify: `index.html:252-263` (result-value and result-unit)
- Modify: `index.html:265-270` (result-notation)

**Step 1: Update header h1**

Change `.header h1` from:

```css
.header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}
```

To:

```css
.header h1 {
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}
```

**Step 2: Update subtitle**

Change `.header .subtitle` from:

```css
.header .subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}
```

To:

```css
.header .subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.15em;
}
```

**Step 3: Update card title**

Change `.card-title` from:

```css
.card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
```

To:

```css
.card-title {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 12px;
}
```

**Step 4: Update result value**

Change `.result-value` from:

```css
.result-value {
  font-size: 48px;
  font-weight: 700;
  color: var(--success-color);
  line-height: 1.2;
}
```

To:

```css
.result-value {
  font-family: var(--font-serif);
  font-size: 52px;
  font-weight: 700;
  color: var(--success-color);
  line-height: 1.2;
}
```

**Step 5: Update result notation (K-Ultra X.Y.Z)**

Change `.result-notation` from:

```css
.result-notation {
  font-size: 20px;
  color: var(--accent-color);
  margin-top: 8px;
  font-weight: 500;
}
```

To:

```css
.result-notation {
  font-size: 20px;
  color: var(--text-secondary);
  margin-top: 8px;
  font-weight: 400;
}
```

**Step 6: Update info-list line height**

Change `.info-list` from:

```css
.info-list {
  list-style: none;
  font-size: 13px;
  color: var(--text-secondary);
}
```

To:

```css
.info-list {
  list-style: none;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}
```

**Step 7: Verify**

Open in browser. Title should be in serif font with wider spacing. Card labels should be small uppercase. Result number should be large serif in red-clay color.

**Step 8: Commit**

```bash
git add index.html
git commit -m "feat: apply wabi-sabi typography system"
```

---

### Task 5: Update card and layout styles

**Files:**
- Modify: `index.html:53-56` (container)
- Modify: `index.html:89-92` (header margin)
- Modify: `index.html:106-112` (card)
- Modify: `index.html:319-323` (info-section border)
- Modify: `index.html:351-360` (disclaimer)

**Step 1: Update container width**

Change `.container` `max-width` from `480px` to `440px`.

**Step 2: Update body padding**

Change `body` `padding` from `20px` to `24px`.

**Step 3: Update header margin**

Change `.header` `margin-bottom` from `32px` to `40px`.

**Step 4: Update card styles**

Change `.card` from:

```css
.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}
```

To:

```css
.card {
  background: var(--card-bg);
  border: none;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(45, 42, 38, 0.06);
  padding: 28px 24px;
  margin-bottom: 20px;
}
```

**Step 5: Update input/select border radius**

Change `.grinder-select` `border-radius` from `8px` to `4px`.
Change `.input-field` `border-radius` from `8px` to `4px`.

**Step 6: Update focus styles**

Change `.grinder-select:focus` and `.input-field:focus` box-shadow from `rgba(37, 99, 235, 0.1)` to `rgba(107, 124, 94, 0.12)`.

**Step 7: Update brew-method bar**

Change `.brew-method` from:

```css
.brew-method {
  ...
  background: rgba(22, 163, 74, 0.08);
  border-radius: 8px;
  ...
}
```

To:

```css
.brew-method {
  ...
  background: rgba(107, 124, 94, 0.08);
  border-radius: 4px;
  ...
}
```

**Step 8: Update warning bar**

Change `.warning` from:

```css
.warning {
  ...
  background: rgba(217, 119, 6, 0.1);
  border-radius: 8px;
  ...
}
```

To:

```css
.warning {
  ...
  background: rgba(184, 134, 11, 0.08);
  border-radius: 4px;
  ...
}
```

**Step 9: Update info-section**

Remove `border-top` from `.info-section`, replace with just `margin-top: 24px`.

**Step 10: Update disclaimer**

Change `.disclaimer` from:

```css
.disclaimer {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 24px;
  padding: 12px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}
```

To:

```css
.disclaimer {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 24px;
  padding: 12px;
  background: none;
  border-radius: 0;
  border: none;
}
```

**Step 11: Update dark mode brew-method**

Change dark mode `.brew-method` background from `rgba(34, 197, 94, 0.1)` to `rgba(138, 158, 122, 0.1)`.

**Step 12: Update responsive desktop card padding**

Change the `@media (min-width: 640px)` `.card` padding from `28px` to `32px 28px`.

**Step 13: Update select arrow SVG color (light mode)**

Change the `.grinder-select` `background-image` SVG fill from `%23666` to `%238a8278` to match the new `--text-secondary`.

**Step 14: Update direction arrow color**

Change `.direction-arrow` `color` from `var(--accent-color)` to `var(--text-primary)`.

**Step 15: Verify**

Open in browser. Cards should float on the warm background with subtle shadows (no borders). Spacing should feel more spacious. Disclaimer should be plain text at bottom.

**Step 16: Commit**

```bash
git add index.html
git commit -m "feat: apply wabi-sabi card and layout styles"
```

---

### Task 6: Restyle language switcher to text links

**Files:**
- Modify: `index.html:59-86` (lang-switcher CSS)
- Modify: `index.html:420-423` (lang-switcher HTML)

**Step 1: Update lang-switcher HTML**

Change the language switcher HTML from:

```html
<div class="lang-switcher">
  <button class="lang-btn active" data-lang="zh">中文</button>
  <button class="lang-btn" data-lang="en">EN</button>
</div>
```

To:

```html
<div class="lang-switcher">
  <button class="lang-btn active" data-lang="zh">中文</button>
  <span class="lang-sep">·</span>
  <button class="lang-btn" data-lang="en">EN</button>
</div>
```

**Step 2: Update lang-switcher CSS**

Change `.lang-switcher` and `.lang-btn` styles from:

```css
.lang-switcher {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 24px;
}

.lang-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.lang-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.lang-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}
```

To:

```css
.lang-switcher {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  margin-bottom: 24px;
}

.lang-sep {
  color: var(--text-secondary);
  font-size: 14px;
  user-select: none;
}

.lang-btn {
  padding: 2px 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
  border-bottom: 1px solid transparent;
}

.lang-btn:hover {
  color: var(--text-primary);
  border-bottom-color: var(--text-primary);
}

.lang-btn.active {
  color: var(--text-primary);
  font-weight: 600;
  background: none;
  border-bottom: none;
}
```

**Step 3: Verify**

Open in browser. Language switcher should now show as plain text: **中文** · EN. Clicking should toggle bold state. No button backgrounds or borders.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: restyle language switcher to minimal text links"
```

---

### Task 7: Final visual verification and screenshot

**Step 1: Light mode verification checklist**

Open `index.html` in browser and verify:

- [ ] Background is warm paper-white (#f5f0e8)
- [ ] Cards have no borders, subtle shadow
- [ ] Title is serif font with letter spacing
- [ ] Card labels are small uppercase
- [ ] Result number is large serif in red-clay color
- [ ] Language switcher is plain text with dot separator
- [ ] Brew recommendation bar has matcha green tint
- [ ] Direction arrow is ink-colored (not blue)
- [ ] K-Ultra notation is in muted gray (not blue)
- [ ] Disclaimer is plain text (no box)
- [ ] Focus states use matcha green

**Step 2: Dark mode verification**

Toggle system to dark mode:

- [ ] Background is warm dark brown (not pure black)
- [ ] Text is warm off-white (not pure white)
- [ ] Cards are subtly lighter than background
- [ ] All accent colors properly adjusted for dark mode

**Step 3: Mobile verification**

Resize browser to 375px width:

- [ ] Layout adapts properly
- [ ] Text is readable
- [ ] Input fields are usable

**Step 4: Functional smoke test**

- [ ] Select C40 → K-Ultra, input 20, result should show ~72-73
- [ ] Select EK43 → C40, input 9.5, result should show ~20
- [ ] Language switch works
- [ ] Out-of-range warning appears for C40 input 50

**Step 5: Commit all remaining changes (if any)**

```bash
git add index.html
git commit -m "feat: complete wabi-sabi visual redesign v2.0"
```
