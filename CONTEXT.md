# 冲煮手记 / Brew Journal

A single-page web tool for coffee enthusiasts. Originally a grinder setting **Converter** (repo/URL still `grinder-converter`); repositioned so the brewing **Journal** is the primary feature and the Converter becomes a secondary aid. See `docs/adr/0001` (reposition) and `docs/adr/0002` (Bag model).

## Language

**Dial-in**:
The core job: iterating across brews toward a better cup of the same coffee, by adjusting variables (grind, ratio, time, temperature) and comparing the results.
_Avoid_: "tuning", "calibrating" (calibration refers to the Converter's anchor data, not the user's brewing).

**Bag**:
A first-class entity: one physical bag of coffee being dialed in — identified by coffee name + roast date (a re-bought coffee with a new roast date is a new Bag, because freshness changes the grind). Owns the bean identity (name, origin, roast date, roast level), the **grinder model** used to dial it, a status (active/finished), and a series of **Brews**. The natural bounded "project" of the Dial-in job.
_Avoid_: "bean" (the physical grounds), "coffee" alone (ambiguous between the offering and the drink). "Coffee" is acceptable in casual user-facing copy for a Bag.

**Brew**:
A single cup-making event recorded *against a Bag* — the tuned variables (grind setting, **method**, dripper, dose, yield, water temp, time, pours) and outcomes (flavour notes, rating, extraction TDS/EY), plus its own date and weather. Grinder *setting* and *method* live here (they change attempt-to-attempt); grinder *model* lives on the Bag. The current code calls this an "entry"; prefer **Brew** in product language, "entry" only for the stored record.
_Avoid_: "session", "log entry" (in user-facing text).

**Journal**:
The whole of the primary feature: the **Bag**s, their **Brew**s, and the dial-in views over them. Home is the bag-list **Dashboard**; a Bag opens to its dial-in timeline. Rendered as clean editorial cards (the old two-page paper "spread", handwriting fonts, and ruled lines are being removed).
_Avoid_: "diary" (implies write-once reflection; the job is repeat-visit dial-in), "log" (overloaded with verb sense).

**Converter**:
The grinder-setting translation feature (C40 ↔ K-Ultra ↔ EK43, via piecewise interpolation through K-Ultra as hub). Demoted from primary to a secondary aid, reachable two ways: a standalone page (`#/convert`, preserves existing audience/links) and an inline affordance at a Brew's grind-setting field (translate a recipe from another grinder into the Bag's grinder units).
_Avoid_: "calculator".

**Best brew**:
The reference Brew within a Bag — the highest-rated one (latest wins on a tie). Pinned at the top of the Bag's timeline as the current dial-in target to beat.
_Avoid_: "favourite" (it's outcome-ranked, not hand-picked).

## Resolved decisions

- **Method is not a grouping layer** — chose Bag → Brew, not Bag → Recipe → Brew. Method (e.g. "V60") is a field on the Brew. When a Bag has mixed methods, the comparison view groups by method.
- **Bag owns grinder model; Brew owns grinder setting** — the model is stable per bag, the setting is the thing you tune attempt-to-attempt.

## Example dialogue

> **Dev:** When someone re-buys the same Ethiopia they finished last month, is that the same Bag?
> **Expert:** No — new roast date, new Bag. Fresh beans degas more, so the grind starts somewhere different. The dial-in resets.
> **Dev:** So the Brews from the old bag don't move over?
> **Expert:** Right. They stay with the old Bag as history. The new Bag starts empty — though I'd happily copy my old *best brew*'s settings as the first attempt's starting point.
> **Dev:** And if you pull that bag as espresso one morning and V60 the next?
> **Expert:** Same Bag, two Brews with different methods. Just don't compare the espresso shots against the V60s — the timeline should group them by method so I'm comparing like with like.
> **Dev:** Where does the Converter come in?
> **Expert:** Only when I'm logging. The recipe card says "K-Ultra 75" but my Bag's on a C40 — I tap convert at the grind field and it tells me where to set my dial. I'm not "using the converter", I'm logging a brew.
