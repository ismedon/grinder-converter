# Brews belong to a first-class Bag, replacing the flat entry list

Dialing in is inherently per-coffee: you compare attempts for the same bag and change one variable at a time. The old flat array of brew "entries" had no grouping, so we introduce a first-class **Bag** (identified by coffee name + roast date) that owns a series of **Brews**. The grinder *model* lives on the Bag; the grinder *setting* and brew *method* live on each Brew (they are what you tune).

## Considered options

- **Flat brews grouped on the fly by bean name** — rejected: free-text grouping is brittle (typos and re-roasts split a bag apart) and forces re-typing bean info every entry.
- **Bag → Recipe → Brew (three levels)** — rejected: over-engineered for a personal tool. Method is a field on the Brew; the comparison view groups by method when a Bag is mixed.

## Consequences

- Storage moves to a new localStorage key in the Bag→Brew shape. Existing `grinder-brew-log-v1` data is **auto-migrated on load**, consolidating flat entries into Bags by (name + roast date); the old key is left untouched as a backup, and `import` accepts both the old flat shape and the new shape.
- Hard to reverse once users accumulate Bag-structured data — hence recorded here.
