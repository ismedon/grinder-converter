import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function makeElementStub() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    textContent: "",
    innerHTML: "",
    value: "",
    min: "",
    max: "",
    step: "",
    placeholder: "",
    hidden: false,
    dataset: {},
  };
}

// In-memory localStorage stub. Pass `seed` (string|undefined) to preset the
// `grinder-brew-log-v1` key — useful for exercising the corrupt-JSON branch.
function makeLocalStorage(seed) {
  const store = new Map();
  if (typeof seed === "string") store.set("grinder-brew-log-v1", seed);
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
    addEventListener() {},
    removeEventListener() {},
  };

  const context = { document: documentStub, console, setTimeout, clearTimeout };
  if (localStorage) context.localStorage = localStorage;
  vm.createContext(context);
  vm.runInContext(scriptMatch[1], context);
  return context;
}

test("BrewLog is reachable from the VM context (declared with var)", () => {
  const ctx = loadContext();
  assert.equal(typeof ctx.BrewLog, "object");
  assert.equal(typeof ctx.BrewLog.createEntry, "function");
  assert.equal(ctx.BrewLog.STORAGE_KEY, "grinder-brew-log-v1");
});

test("createEntry returns all schema fields with sane defaults", () => {
  const ctx = loadContext();
  const entry = ctx.BrewLog.createEntry();

  assert.equal(typeof entry.id, "string");
  assert.ok(entry.id.length > 0, "id should be non-empty");
  assert.equal(entry.schemaVersion, 1);
  assert.match(entry.createdAt, /^\d{4}-\d{2}-\d{2}T/, "createdAt should be ISO");
  assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, "date should be YYYY-MM-DD");
  assert.equal(entry.weather, "");
  assert.equal(entry.rating, 0);
  assert.equal(entry.flavorNotes, "");
  assert.equal(entry.reflection, "");

  // Nested groups exist with all expected fields, all blank strings
  const expectedGroups = {
    beans: ["name", "origin", "roastDate", "roastLevel"],
    grinder: ["model", "setting", "distributionNote"],
    brew: ["method", "dripper", "waterTempC", "dose", "yield", "totalTimeSec", "pourSegments"],
    extraction: ["tds", "ey"],
  };
  for (const [g, fields] of Object.entries(expectedGroups)) {
    assert.equal(typeof entry[g], "object", `group ${g} should exist`);
    for (const f of fields) {
      assert.ok(f in entry[g], `${g}.${f} should be present`);
      assert.equal(entry[g][f], "", `${g}.${f} should default to empty string`);
    }
  }
});

test("createEntry generates distinct ids", () => {
  const ctx = loadContext();
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(ctx.BrewLog.createEntry().id);
  assert.equal(ids.size, 50, "50 consecutive createEntry calls should yield unique ids");
});

test("sanitizeEntry drops malformed input instead of throwing", () => {
  const ctx = loadContext();
  const { sanitizeEntry } = ctx.BrewLog;

  assert.equal(sanitizeEntry(null), null);
  assert.equal(sanitizeEntry(undefined), null);
  assert.equal(sanitizeEntry("a string"), null);
  assert.equal(sanitizeEntry(42), null);
  assert.equal(sanitizeEntry({}), null, "missing id → null");
  assert.equal(sanitizeEntry({ id: "" }), null, "empty id → null");
  assert.equal(sanitizeEntry({ id: 123 }), null, "non-string id → null");
});

test("sanitizeEntry preserves known fields and clamps rating to 0-5 integer", () => {
  const ctx = loadContext();
  const { sanitizeEntry } = ctx.BrewLog;

  const clean = sanitizeEntry({
    id: "abc",
    rating: 4.2,
    weather: "sunny",
    flavorNotes: "floral",
    beans: { name: "Yirgacheffe", unknownField: "ignored" },
    brew: { dose: "15", waterTempC: "94" },
    unknownTopLevel: "dropped",
  });
  assert.equal(clean.id, "abc");
  assert.equal(clean.rating, 4, "4.2 rounds to 4");
  assert.equal(clean.weather, "sunny");
  assert.equal(clean.flavorNotes, "floral");
  assert.equal(clean.beans.name, "Yirgacheffe");
  assert.equal(clean.beans.origin, "", "unset nested subfield defaults to blank");
  assert.equal(clean.brew.dose, "15");
  assert.equal(clean.brew.waterTempC, "94");
  assert.equal("unknownField" in clean.beans, false, "unknown nested fields dropped");
  assert.equal("unknownTopLevel" in clean, false, "unknown top-level fields dropped");

  assert.equal(sanitizeEntry({ id: "a", rating: 99 }).rating, 5, "rating clamped up to 5");
  assert.equal(sanitizeEntry({ id: "a", rating: -3 }).rating, 0, "rating clamped down to 0");
  assert.equal(sanitizeEntry({ id: "a", rating: "bad" }).rating, 0, "non-numeric rating → 0");
});

test("sanitizeEntry rejects non-primitive scalar fields from untrusted import", () => {
  const ctx = loadContext();
  const { sanitizeEntry } = ctx.BrewLog;

  const clean = sanitizeEntry({
    id: "x",
    flavorNotes: { evil: 1 },
    reflection: ["a", "b"],
    weather: null,
    date: { not: "a string" },
    beans: { name: { nested: 1 }, origin: "Yirgacheffe" },
    brew: { dose: ["array"], waterTempC: "94" },
  });
  assert.equal(clean.flavorNotes, "", "object scalar dropped, default kept");
  assert.equal(clean.reflection, "", "array scalar dropped, default kept");
  assert.equal(clean.weather, "", "null scalar dropped, default kept");
  assert.equal(clean.beans.name, "", "object nested-scalar dropped");
  assert.equal(clean.beans.origin, "Yirgacheffe", "valid string still copied");
  assert.equal(clean.brew.dose, "", "array nested-scalar dropped");
  assert.equal(clean.brew.waterTempC, "94", "valid string still copied");
  // Date default is still a YYYY-MM-DD string, not the rejected object
  assert.match(clean.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("sanitizeEntry rejects array as a nested group", () => {
  const ctx = loadContext();
  const clean = ctx.BrewLog.sanitizeEntry({ id: "x", beans: ["not", "an", "object"] });
  assert.equal(clean.beans.name, "", "array group is treated as missing");
  assert.equal(clean.beans.origin, "");
});

test("sanitizeEntry normalizes known Chinese roast level strings to enum keys", () => {
  const { sanitizeEntry } = loadContext().BrewLog;
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "超浅烘" } }).beans.roastLevel, "veryLight");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "浅烘" } }).beans.roastLevel, "light");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "中烘" } }).beans.roastLevel, "medium");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "深烘" } }).beans.roastLevel, "dark");
});

test("sanitizeEntry normalizes English roast level strings case-insensitively", () => {
  const { sanitizeEntry } = loadContext().BrewLog;
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "Light" } }).beans.roastLevel, "light");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "MEDIUM" } }).beans.roastLevel, "medium");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "Extra Light" } }).beans.roastLevel, "veryLight");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "  dark  " } }).beans.roastLevel, "dark", "whitespace trimmed");
});

test("sanitizeEntry passes valid enum keys through unchanged", () => {
  const { sanitizeEntry } = loadContext().BrewLog;
  for (const key of ["veryLight", "light", "medium", "dark"]) {
    assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: key } }).beans.roastLevel, key);
  }
});

test("sanitizeEntry drops unknown roast level strings to empty", () => {
  const { sanitizeEntry } = loadContext().BrewLog;
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "french" } }).beans.roastLevel, "");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "🔥" } }).beans.roastLevel, "");
  assert.equal(sanitizeEntry({ id: "a", beans: { roastLevel: "" } }).beans.roastLevel, "");
});

test("export → import roundtrip preserves every entry", () => {
  const ctx = loadContext();
  const { createEntry, exportPayload, extractEntries, mergeImport } = ctx.BrewLog;

  const original = [
    createEntry({ id: "e1", rating: 4, flavorNotes: "berry" }),
    createEntry({ id: "e2", rating: 2, beans: { name: "Ethiopia", origin: "Guji", roastDate: "", roastLevel: "light" } }),
    createEntry({ id: "e3", reflection: "a bit over-extracted" }),
  ];

  const payload = exportPayload(original);
  assert.equal(payload.schemaVersion, 1);
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(payload.entries));
  assert.equal(payload.entries.length, 3);

  // Simulate a write → read cycle through JSON
  const roundtripped = JSON.parse(JSON.stringify(payload));
  const extracted = extractEntries(roundtripped);
  assert.equal(extracted.length, 3);

  const { entries: merged, added, skipped } = mergeImport([], extracted);
  assert.equal(added, 3);
  assert.equal(skipped, 0);
  assert.equal(merged.length, 3);

  const byId = new Map(merged.map(e => [e.id, e]));
  assert.equal(byId.get("e1").rating, 4);
  assert.equal(byId.get("e1").flavorNotes, "berry");
  assert.equal(byId.get("e2").beans.name, "Ethiopia");
  assert.equal(byId.get("e2").beans.origin, "Guji");
  assert.equal(byId.get("e3").reflection, "a bit over-extracted");
});

test("extractEntries accepts raw arrays or {entries} payloads; rejects bad shapes", () => {
  const ctx = loadContext();
  const { extractEntries } = ctx.BrewLog;

  const fromArray = extractEntries([{ id: "a" }]);
  assert.ok(Array.isArray(fromArray));
  assert.equal(fromArray.length, 1);
  assert.equal(fromArray[0].id, "a");

  const fromPayload = extractEntries({ entries: [{ id: "b" }] });
  assert.ok(Array.isArray(fromPayload));
  assert.equal(fromPayload[0].id, "b");

  assert.equal(extractEntries({ bogus: 1 }), null);
  assert.equal(extractEntries(null), null);
  assert.equal(extractEntries("nope"), null);
});

test("mergeImport keeps the entry with the later createdAt on id collision", () => {
  const ctx = loadContext();
  const { mergeImport } = ctx.BrewLog;

  const existing = [
    { id: "shared", createdAt: "2026-04-10T00:00:00.000Z", rating: 2, schemaVersion: 1,
      date: "2026-04-10", weather: "", beans: {}, grinder: {}, brew: {}, extraction: {},
      flavorNotes: "old", reflection: "" },
    { id: "keep", createdAt: "2026-04-11T00:00:00.000Z", rating: 5, schemaVersion: 1,
      date: "2026-04-11", weather: "", beans: {}, grinder: {}, brew: {}, extraction: {},
      flavorNotes: "", reflection: "" },
  ];
  const incoming = [
    // Newer createdAt — should win over existing "shared"
    { id: "shared", createdAt: "2026-04-14T00:00:00.000Z", rating: 4, flavorNotes: "new" },
    // New id — should be added
    { id: "fresh", createdAt: "2026-04-13T00:00:00.000Z", rating: 3, flavorNotes: "fresh" },
  ];

  const { entries, added, skipped } = mergeImport(existing, incoming);
  assert.equal(added, 1, "only `fresh` is new");
  assert.equal(skipped, 0);
  const byId = new Map(entries.map(e => [e.id, e]));
  assert.equal(byId.size, 3);
  assert.equal(byId.get("shared").flavorNotes, "new", "newer createdAt wins");
  assert.equal(byId.get("shared").rating, 4);
  assert.equal(byId.get("keep").rating, 5, "untouched existing entry preserved");
  assert.equal(byId.get("fresh").flavorNotes, "fresh");
});

test("mergeImport keeps existing when incoming createdAt is older", () => {
  const ctx = loadContext();
  const { mergeImport } = ctx.BrewLog;

  const existing = [{
    id: "shared", createdAt: "2026-04-14T00:00:00.000Z", rating: 5, schemaVersion: 1,
    date: "2026-04-14", weather: "", beans: {}, grinder: {}, brew: {}, extraction: {},
    flavorNotes: "winner", reflection: "",
  }];
  const incoming = [
    { id: "shared", createdAt: "2026-04-10T00:00:00.000Z", rating: 1, flavorNotes: "loser" },
  ];

  const { entries, added, skipped } = mergeImport(existing, incoming);
  assert.equal(added, 0);
  assert.equal(skipped, 1, "older createdAt is skipped");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].flavorNotes, "winner");
});

test("mergeImport returns existing unchanged when incoming is not an array", () => {
  const ctx = loadContext();
  const existing = [{ id: "a" }];
  const result = ctx.BrewLog.mergeImport(existing, null);
  assert.equal(result.entries, existing);
  assert.equal(result.added, 0);
  assert.equal(result.skipped, 0);
});

function assertLoadResult(result, { corrupt, length }) {
  assert.equal(result.corrupt, corrupt);
  assert.ok(Array.isArray(result.entries));
  assert.equal(result.entries.length, length);
}

test("load() on corrupt JSON returns { entries: [], corrupt: true }", () => {
  const ctx = loadContext({ localStorage: makeLocalStorage("{not valid json") });
  assertLoadResult(ctx.BrewLog.load(), { corrupt: true, length: 0 });
});

test("load() on non-array JSON returns { entries: [], corrupt: true }", () => {
  const ctx = loadContext({ localStorage: makeLocalStorage('{"entries": []}') });
  assertLoadResult(ctx.BrewLog.load(), { corrupt: true, length: 0 });
});

test("load() with no stored value returns empty, non-corrupt", () => {
  const ctx = loadContext({ localStorage: makeLocalStorage() });
  assertLoadResult(ctx.BrewLog.load(), { corrupt: false, length: 0 });
});

test("load() without a localStorage global also returns empty, non-corrupt", () => {
  const ctx = loadContext();
  assertLoadResult(ctx.BrewLog.load(), { corrupt: false, length: 0 });
});

test("load() filters out malformed entries from an otherwise-valid array", () => {
  const seed = JSON.stringify([
    { id: "ok", rating: 3 },
    null,
    { /* missing id */ rating: 5 },
    "not-an-object",
    { id: "ok2", rating: 2 },
  ]);
  const ctx = loadContext({ localStorage: makeLocalStorage(seed) });
  const { entries, corrupt } = ctx.BrewLog.load();
  assert.equal(corrupt, false, "partial-malformed array is not flagged as corrupt");
  assert.equal(entries.length, 2);
  const ids = entries.map(e => e.id).sort();
  assert.equal(ids[0], "ok");
  assert.equal(ids[1], "ok2");
});

test("save() → load() roundtrip through stubbed localStorage", () => {
  const ls = makeLocalStorage();
  const ctx = loadContext({ localStorage: ls });
  const { createEntry, save, load } = ctx.BrewLog;

  const a = createEntry({ id: "r1", rating: 4, flavorNotes: "bright" });
  const b = createEntry({ id: "r2", rating: 2 });
  const result = save([a, b]);
  assert.equal(result.ok, true);

  const stored = ls.getItem("grinder-brew-log-v1");
  assert.ok(stored && stored.startsWith("["), "entries written as JSON array");

  const { entries, corrupt } = load();
  assert.equal(corrupt, false);
  assert.equal(entries.length, 2);
  const byId = new Map(entries.map(e => [e.id, e]));
  assert.equal(byId.get("r1").flavorNotes, "bright");
  assert.equal(byId.get("r1").rating, 4);
  assert.equal(byId.get("r2").rating, 2);
});
