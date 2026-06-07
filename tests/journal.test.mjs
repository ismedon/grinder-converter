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
