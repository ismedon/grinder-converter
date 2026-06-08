# Reposition from grinder converter to a dial-in brewing journal

The app began as a grinder-setting **Converter**, but conversion is a one-shot utility while the brewing **Journal** is what a user returns to daily. We are making the **Journal the primary feature** — the app opens to a bag-list dashboard — and **demoting the Converter to a secondary aid**: a standalone `#/convert` page plus an inline affordance at a Brew's grind-setting field. User-facing product name becomes **冲煮手记 / Brew Journal**.

## Considered options

- **Keep the Converter primary, Journal as a tab** (status quo) — rejected: the repeat-visit value is in dial-in, not one-off conversion.
- **Delete the Converter** — rejected: it has an existing audience and inbound links.

## Consequences

- The repo name and GitHub Pages URL (`grinder-converter`) are **deliberately kept** despite the product rename, to preserve inbound links/SEO. A repo named "grinder-converter" that contains a brewing journal is expected, not an oversight.
- The standalone `#/convert` page exists largely to keep that existing conversion audience landing somewhere sensible.
- The single-file architecture (everything in `index.html`, no build) is retained through the expansion — see CLAUDE.md.
