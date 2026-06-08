import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Minimal element stub — Phase A logic never touches the DOM, but the inline
// script wires DOM at module top-level, so stubs must exist.
function makeElementStub() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    textContent: "", innerHTML: "", value: "", hidden: false, dataset: {},
  };
}

function makeLocalStorage(seed) {
  const store = new Map();
  if (seed && typeof seed === "object") {
    for (const [k, v] of Object.entries(seed)) store.set(k, v);
  }
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    _store: store,
  };
}

function loadContext({ localStorage } = {}) {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, "Failed to extract inline script from index.html");
  const elementCache = new Map();
  const documentStub = {
    documentElement: { lang: "zh-CN" },
    body: makeElementStub(),
    getElementById(id) {
      if (!elementCache.has(id)) elementCache.set(id, makeElementStub());
      return elementCache.get(id);
    },
    querySelector() { return makeElementStub(); },
    querySelectorAll() { return []; },
    createElement() { return makeElementStub(); },
    addEventListener() {}, removeEventListener() {},
  };
  const context = { document: documentStub, console, setTimeout, clearTimeout };
  if (localStorage) context.localStorage = localStorage;
  vm.createContext(context);
  vm.runInContext(scriptMatch[1], context);
  return context;
}

test("createBag returns all schema fields with sane defaults", () => {
  const ctx = loadContext();
  const bag = ctx.BrewLog.createBag();
  assert.equal(typeof bag.id, "string");
  assert.ok(bag.id.length > 0);
  assert.equal(bag.schemaVersion, 2);
  assert.match(bag.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(bag.name, "");
  assert.equal(bag.origin, "");
  assert.equal(bag.roastDate, "");
  assert.equal(bag.roastLevel, "");
  assert.equal(bag.grinderModel, "");
  assert.equal(bag.status, "active");
  assert.ok(Array.isArray(bag.brews));
  assert.equal(bag.brews.length, 0);
});

test("createBrew returns all schema fields with sane defaults", () => {
  const ctx = loadContext();
  const brew = ctx.BrewLog.createBrew();
  assert.equal(typeof brew.id, "string");
  assert.match(brew.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(brew.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(brew.weather, "");
  assert.equal(brew.grinderSetting, "");
  for (const f of ["method", "dripper", "waterTempC", "dose", "yield", "totalTimeSec", "pourSegments"]) {
    assert.equal(brew.brew[f], "", `brew.${f} should default to ""`);
  }
  assert.equal(brew.extraction.tds, "");
  assert.equal(brew.extraction.ey, "");
  assert.equal(brew.rating, 0);
  assert.equal(brew.flavorNotes, "");
  assert.equal(brew.reflection, "");
});

test("bagKey normalizes name + roastDate; bagIdFromKey is deterministic", () => {
  const ctx = loadContext();
  const k1 = ctx.BrewLog.bagKey("  Ethiopia Guji ", "2026-05-01");
  const k2 = ctx.BrewLog.bagKey("ethiopia guji", "2026-05-01");
  assert.equal(k1, k2, "case and surrounding space should not matter");
  assert.notEqual(k1, ctx.BrewLog.bagKey("ethiopia guji", "2026-05-02"));
  const id1 = ctx.BrewLog.bagIdFromKey(k1);
  const id2 = ctx.BrewLog.bagIdFromKey(k2);
  assert.equal(id1, id2);
  assert.match(id1, /^bag_[0-9a-z]+$/);
});

test("sanitizeBrew drops malformed input, keeps primitives, clamps rating", () => {
  const ctx = loadContext();
  assert.equal(ctx.BrewLog.sanitizeBrew(null), null);
  assert.equal(ctx.BrewLog.sanitizeBrew("nope"), null);
  assert.equal(ctx.BrewLog.sanitizeBrew({}), null, "missing id is dropped");

  const clean = ctx.BrewLog.sanitizeBrew({
    id: "b1", date: "2026-05-01", grinderSetting: "20",
    brew: { method: "V60", dripper: { evil: 1 }, dose: 15 },
    extraction: { tds: 1.4, ey: 21 },
    rating: 9, flavorNotes: "floral", junkField: "x",
  });
  assert.equal(clean.id, "b1");
  assert.equal(clean.grinderSetting, "20");
  assert.equal(clean.brew.method, "V60");
  assert.equal(clean.brew.dripper, "", "object subfield rejected");
  assert.equal(clean.brew.dose, 15);
  assert.equal(clean.extraction.tds, 1.4);
  assert.equal(clean.rating, 5, "rating clamped to 0-5");
  assert.equal(clean.junkField, undefined, "unknown fields stripped");
});

test("sanitizeBag drops malformed input and sanitizes nested brews", () => {
  const ctx = loadContext();
  assert.equal(ctx.BrewLog.sanitizeBag(null), null);
  assert.equal(ctx.BrewLog.sanitizeBag({}), null, "missing id is dropped");

  const clean = ctx.BrewLog.sanitizeBag({
    id: "bag_1", name: "Guji", roastDate: "2026-05-01",
    grinderModel: "C40", status: "weird",
    brews: [
      { id: "b1", grinderSetting: "20" },
      null,
      { noId: true },
      "garbage",
    ],
  });
  assert.equal(clean.id, "bag_1");
  assert.equal(clean.name, "Guji");
  assert.equal(clean.grinderModel, "C40");
  assert.equal(clean.status, "active", "unknown status falls back to active");
  assert.equal(clean.brews.length, 1, "only the valid brew survives");
  assert.equal(clean.brews[0].id, "b1");
});

test("migrateEntriesToBags groups entries by name + roastDate", () => {
  const ctx = loadContext();
  const entries = [
    ctx.BrewLog.createEntry({
      id: "e1", createdAt: "2026-05-01T08:00:00.000Z", date: "2026-05-01",
      beans: { name: "Guji", origin: "ET", roastDate: "2026-04-20", roastLevel: "light" },
      grinder: { model: "C40", setting: "20" },
      brew: { method: "V60", dripper: "Origami", waterTempC: "92", dose: "15",
              yield: "250", totalTimeSec: "150", pourSegments: "" },
      extraction: { tds: "1.4", ey: "21" },
      rating: 4, flavorNotes: "floral", reflection: "good",
    }),
    ctx.BrewLog.createEntry({
      id: "e2", createdAt: "2026-05-02T08:00:00.000Z", date: "2026-05-02",
      beans: { name: "guji", origin: "ET", roastDate: "2026-04-20", roastLevel: "light" },
      grinder: { model: "C40", setting: "22" },
      rating: 5,
    }),
    ctx.BrewLog.createEntry({
      id: "e3", createdAt: "2026-05-03T08:00:00.000Z", date: "2026-05-03",
      beans: { name: "Kenya AA", origin: "KE", roastDate: "2026-04-25", roastLevel: "medium" },
      grinder: { model: "K-Ultra", setting: "75" },
      rating: 3,
    }),
  ];
  const bags = ctx.BrewLog.migrateEntriesToBags(entries);
  assert.equal(bags.length, 2, "two distinct (name+roastDate) groups");

  const guji = bags.find(b => b.name.toLowerCase() === "guji");
  assert.ok(guji);
  assert.equal(guji.roastDate, "2026-04-20");
  assert.equal(guji.grinderModel, "C40");
  assert.equal(guji.brews.length, 2);
  // brew identity + moved fields preserved
  const b1 = guji.brews.find(b => b.id === "e1");
  assert.equal(b1.grinderSetting, "20");
  assert.equal(b1.brew.method, "V60");
  assert.equal(b1.extraction.tds, "1.4");
  assert.equal(b1.rating, 4);
  // deterministic bag id from natural key
  assert.equal(guji.id, ctx.BrewLog.bagIdFromKey(ctx.BrewLog.bagKey("guji", "2026-04-20")));
});

test("migrateEntriesToBags is idempotent and order-stable across runs", () => {
  const ctx = loadContext();
  const entries = [
    ctx.BrewLog.createEntry({ id: "e1", beans: { name: "A", roastDate: "2026-01-01" } }),
    ctx.BrewLog.createEntry({ id: "e2", beans: { name: "A", roastDate: "2026-01-01" } }),
  ];
  const first = JSON.stringify(ctx.BrewLog.migrateEntriesToBags(entries));
  const second = JSON.stringify(ctx.BrewLog.migrateEntriesToBags(entries));
  assert.equal(first, second);
});

test("loadJournal returns empty when no data exists", () => {
  const ctx = loadContext({ localStorage: makeLocalStorage() });
  const res = ctx.BrewLog.loadJournal();
  assert.ok(Array.isArray(res.bags));
  assert.equal(res.bags.length, 0);
  assert.equal(res.corrupt, false);
  assert.equal(res.migrated, false);
});

test("loadJournal migrates v1 data on first load and preserves the v1 backup", () => {
  const v1 = JSON.stringify([
    { id: "e1", schemaVersion: 1, createdAt: "2026-05-01T00:00:00.000Z",
      date: "2026-05-01",
      beans: { name: "Guji", origin: "ET", roastDate: "2026-04-20", roastLevel: "light" },
      grinder: { model: "C40", setting: "20" },
      brew: { method: "V60" }, extraction: {}, rating: 4 },
  ]);
  const ls = makeLocalStorage({ "grinder-brew-log-v1": v1 });
  const ctx = loadContext({ localStorage: ls });

  // Page init runs applyRoute -> renderJournal -> loadJournal, so migration
  // already happened on load: v2 written, v1 preserved as backup.
  assert.ok(ls._store.has("grinder-brew-journal-v2"));
  assert.equal(ls._store.get("grinder-brew-log-v1"), v1);

  // Reading now returns the migrated bag without re-migrating.
  const res = ctx.BrewLog.loadJournal();
  assert.equal(res.migrated, false);
  assert.equal(res.bags.length, 1);
  assert.equal(res.bags[0].brews[0].grinderSetting, "20");

  // If v2 is cleared, loadJournal performs and reports migration again.
  ls._store.delete("grinder-brew-journal-v2");
  const res2 = ctx.BrewLog.loadJournal();
  assert.equal(res2.migrated, true);
  assert.equal(res2.bags.length, 1);
  assert.ok(ls._store.has("grinder-brew-journal-v2"));
});

test("loadJournal flags corrupt v2 JSON without throwing", () => {
  const ls = makeLocalStorage({ "grinder-brew-journal-v2": "{not json" });
  const ctx = loadContext({ localStorage: ls });
  const res = ctx.BrewLog.loadJournal();
  assert.equal(res.corrupt, true);
  assert.ok(Array.isArray(res.bags));
  assert.equal(res.bags.length, 0);
});

test("saveJournal round-trips through loadJournal", () => {
  const ls = makeLocalStorage();
  const ctx = loadContext({ localStorage: ls });
  const bag = ctx.BrewLog.createBag({ id: "bag_x", name: "Test", roastDate: "2026-05-01" });
  bag.brews.push(ctx.BrewLog.createBrew({ id: "b1", grinderSetting: "18" }));
  ctx.BrewLog.saveJournal([bag]);
  const res = ctx.BrewLog.loadJournal();
  assert.equal(res.bags.length, 1);
  assert.equal(res.bags[0].brews[0].grinderSetting, "18");
});

test("exportJournal wraps bags with version + timestamp", () => {
  const ctx = loadContext();
  const payload = ctx.BrewLog.exportJournal([ctx.BrewLog.createBag({ id: "bag_1" })]);
  assert.equal(payload.schemaVersion, 2);
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(payload.bags.length, 1);
});

test("extractBags accepts v2 payloads and raw bag arrays", () => {
  const ctx = loadContext();
  const bag = ctx.BrewLog.createBag({ id: "bag_1", name: "A", roastDate: "2026-01-01" });
  assert.equal(ctx.BrewLog.extractBags({ schemaVersion: 2, bags: [bag] }).length, 1);
  assert.equal(ctx.BrewLog.extractBags([bag]).length, 1);
  assert.equal(ctx.BrewLog.extractBags({ nonsense: true }), null);
});

test("extractBags migrates a v1 import payload into bags", () => {
  const ctx = loadContext();
  const v1Payload = { schemaVersion: 1, entries: [
    { id: "e1", beans: { name: "Guji", roastDate: "2026-04-20" },
      grinder: { model: "C40", setting: "20" } },
  ]};
  const bags = ctx.BrewLog.extractBags(v1Payload);
  assert.equal(bags.length, 1);
  assert.equal(bags[0].brews[0].grinderSetting, "20");
});

test("mergeJournalImport merges by bag natural key and brew id", () => {
  const ctx = loadContext();
  const existing = [ctx.BrewLog.createBag({
    id: "bag_a", name: "Guji", roastDate: "2026-04-20",
    brews: [ctx.BrewLog.createBrew({ id: "b1", createdAt: "2026-05-01T00:00:00.000Z", grinderSetting: "20" })],
  })];
  const incoming = [ctx.BrewLog.createBag({
    id: "bag_zzz", name: "guji", roastDate: "2026-04-20", // same natural key, different id
    brews: [
      ctx.BrewLog.createBrew({ id: "b1", createdAt: "2026-05-09T00:00:00.000Z", grinderSetting: "23" }), // newer -> wins
      ctx.BrewLog.createBrew({ id: "b2", grinderSetting: "25" }), // new brew
    ],
  }), ctx.BrewLog.createBag({ id: "bag_b", name: "Kenya", roastDate: "2026-04-25" })];

  const res = ctx.BrewLog.mergeJournalImport(existing, incoming);
  assert.equal(res.bags.length, 2, "same-key bag merged, new bag added");
  const guji = res.bags.find(b => b.name.toLowerCase() === "guji");
  assert.equal(guji.brews.length, 2, "b1 updated in place, b2 added");
  assert.equal(guji.brews.find(b => b.id === "b1").grinderSetting, "23", "newer brew wins");
  assert.equal(res.addedBags, 1);
  assert.equal(res.addedBrews, 1);
});

test("bestBrew returns highest-rated brew, latest wins ties, null if none rated", () => {
  const ctx = loadContext();
  const mk = (id, rating, createdAt) => ctx.BrewLog.createBrew({ id, rating, createdAt });
  const bag = ctx.BrewLog.createBag({ brews: [
    mk("b1", 4, "2026-05-01T00:00:00.000Z"),
    mk("b2", 5, "2026-05-02T00:00:00.000Z"),
    mk("b3", 5, "2026-05-09T00:00:00.000Z"), // tie at 5, latest
  ]});
  assert.equal(ctx.BrewLog.bestBrew(bag).id, "b3");
  assert.equal(ctx.BrewLog.bestBrew(ctx.BrewLog.createBag({ brews: [mk("x", 0, "2026-05-01T00:00:00.000Z")] })), null);
  assert.equal(ctx.BrewLog.bestBrew(ctx.BrewLog.createBag()), null);
});

test("parseRoute maps the three views and legacy redirects", () => {
  const ctx = loadContext();
  // field-by-field (parseRoute returns VM-realm objects; deepEqual would false-fail)
  assert.equal(ctx.parseRoute("").view, "dashboard");
  assert.equal(ctx.parseRoute("#/").view, "dashboard");
  assert.equal(ctx.parseRoute("#/log").view, "dashboard");
  assert.equal(ctx.parseRoute("#/log/abc").view, "dashboard");
  assert.equal(ctx.parseRoute("#/convert").view, "convert");
  assert.equal(ctx.parseRoute("#/garbage").view, "dashboard");

  const b1 = ctx.parseRoute("#/bag/bag_1");
  assert.equal(b1.view, "bag");
  assert.equal(b1.bagId, "bag_1");
  assert.equal(b1.brewId, null);

  const b2 = ctx.parseRoute("#/bag/bag_1/b9");
  assert.equal(b2.view, "bag");
  assert.equal(b2.bagId, "bag_1");
  assert.equal(b2.brewId, "b9");
});

test("migrateEntriesToBags keeps identity-less entries as separate bags (no empty-key collision)", () => {
  const ctx = loadContext();
  // Two v1 entries with no bean name and no roast date have no natural identity;
  // they must NOT collapse into one shared bag (that would conflate distinct coffees).
  const entries = [
    ctx.BrewLog.createEntry({ id: "e1", grinder: { model: "", setting: "10" } }),
    ctx.BrewLog.createEntry({ id: "e2", grinder: { model: "", setting: "20" } }),
  ];
  const bags = ctx.BrewLog.migrateEntriesToBags(entries);
  assert.ok(Array.isArray(bags));
  assert.equal(bags.length, 2, "identity-less entries stay distinct");
  // each keeps its single brew (no data merged away)
  assert.equal(bags[0].brews.length, 1);
  assert.equal(bags[1].brews.length, 1);
});

test("mergeJournalImport keeps blank-identity bags distinct (no empty-key collision / data loss)", () => {
  const ctx = loadContext();
  // Two blank bags (e.g. created via '+ New' and never filled in) share an empty
  // natural key; importing must not drop one and duplicate the other.
  const existing = [
    ctx.BrewLog.createBag({ id: "bag_blank1", brews: [ctx.BrewLog.createBrew({ id: "a1" })] }),
    ctx.BrewLog.createBag({ id: "bag_blank2", brews: [ctx.BrewLog.createBrew({ id: "a2" })] }),
  ];
  const res = ctx.BrewLog.mergeJournalImport(existing, []);
  assert.equal(res.bags.length, 2, "both blank bags survive an import");
  const ids = res.bags.map((b) => b.id).sort();
  assert.equal(ids[0], "bag_blank1");
  assert.equal(ids[1], "bag_blank2");
});

test("mergeJournalImport still merges a re-imported blank bag by id (idempotent)", () => {
  const ctx = loadContext();
  const existing = [
    ctx.BrewLog.createBag({ id: "bag_blank1", brews: [ctx.BrewLog.createBrew({ id: "a1" })] }),
  ];
  const incoming = [
    ctx.BrewLog.createBag({ id: "bag_blank1", brews: [ctx.BrewLog.createBrew({ id: "a2" })] }),
  ];
  const res = ctx.BrewLog.mergeJournalImport(existing, incoming);
  assert.equal(res.bags.length, 1, "same-id blank bag merges, not duplicated");
  assert.equal(res.bags[0].brews.length, 2, "new brew added to the existing blank bag");
});

test("extractBags keeps a v2 bag that omits the brews key (raw array, not misread as v1)", () => {
  const ctx = loadContext();
  const bags = ctx.BrewLog.extractBags([
    { id: "bag_x", name: "Ethiopia", roastDate: "2026-05-01", grinderModel: "C40" },
  ]);
  assert.ok(Array.isArray(bags));
  assert.equal(bags.length, 1);
  assert.equal(bags[0].id, "bag_x", "bag identity preserved (not stripped via v1 migration)");
  assert.equal(bags[0].name, "Ethiopia");
});

test("extractBags keeps brews-less v2 bags from a {schemaVersion:2, bags} payload", () => {
  const ctx = loadContext();
  const bags = ctx.BrewLog.extractBags({
    schemaVersion: 2,
    bags: [{ id: "bag_y", name: "Kenya", roastDate: "2026-05-02" }],
  });
  assert.equal(bags.length, 1);
  assert.equal(bags[0].id, "bag_y");
  assert.equal(bags[0].name, "Kenya");
});

test("extractBags still migrates a raw v1-entry array (beans/grinder signature)", () => {
  const ctx = loadContext();
  const bags = ctx.BrewLog.extractBags([
    { id: "e1", beans: { name: "Guji", roastDate: "2026-04-20" }, grinder: { model: "C40", setting: "20" } },
  ]);
  assert.equal(bags.length, 1);
  assert.equal(bags[0].brews[0].grinderSetting, "20", "v1 entry still migrated into a bag with a brew");
});
