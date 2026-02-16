import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function makeElementStub() {
  return {
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
    textContent: "",
    value: "",
    min: "",
    max: "",
    step: "",
    placeholder: "",
  };
}

function loadConverterContext() {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, "Failed to extract inline script from index.html");

  const elementCache = new Map();
  const documentStub = {
    documentElement: { lang: "zh-CN" },
    getElementById(id) {
      if (!elementCache.has(id)) {
        elementCache.set(id, makeElementStub());
      }
      return elementCache.get(id);
    },
    querySelectorAll() {
      return [];
    },
  };

  const context = { document: documentStub, console };
  vm.createContext(context);
  vm.runInContext(scriptMatch[1], context);
  return context;
}

function nearlyEqual(actual, expected, tolerance, label) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${label}: actual=${actual}, expected=${expected}, tolerance=${tolerance}, diff=${diff}`
  );
}

test("converter exposes expected runtime API", () => {
  const ctx = loadConverterContext();
  assert.equal(typeof ctx.convertValue, "function");
  assert.equal(typeof ctx.toKUltra, "function");
  assert.equal(typeof ctx.fromKUltra, "function");
});

test("anchor regression: C40 -> K-Ultra", () => {
  const ctx = loadConverterContext();
  const anchors = [
    [0, 0],
    [7, 24],
    [10, 37],
    [13, 49],
    [14, 49],
    [15, 53],
    [19, 67],
    [20, 72.5],
    [24, 86],
    [25, 91.5],
    [26, 91.5],
    [33, 95.5],
    [40, 100],
  ];

  for (const [input, expected] of anchors) {
    const actual = ctx.convertValue(input, "c40", "kUltra");
    nearlyEqual(actual, expected, 0.5, `C40->K anchor input=${input}`);
  }
});

test("anchor regression: EK43 -> K-Ultra", () => {
  const ctx = loadConverterContext();
  const anchors = [
    [0, 24],
    [2.55, 37],
    [4.7, 48],
    [5.1, 50],
    [5.7, 53],
    [8.5, 67],
    [9.5, 72.5],
    [12.3, 86],
    [13.1, 91],
    [13.3, 92],
    [14.55, 95.5],
    [16, 100],
  ];

  for (const [input, expected] of anchors) {
    const actual = ctx.convertValue(input, "ek43", "kUltra");
    nearlyEqual(actual, expected, 0.1, `EK43->K anchor input=${input}`);
  }
});

test("key samples from calibration spec", () => {
  const ctx = loadConverterContext();
  nearlyEqual(ctx.convertValue(20, "c40", "kUltra"), 72.5, 0.5, "C40 20 -> K");
  nearlyEqual(ctx.convertValue(9.5, "ek43", "kUltra"), 72.5, 0.1, "EK43 9.5 -> K");
  nearlyEqual(ctx.convertValue(72.5, "kUltra", "c40"), 20, 1, "K 72.5 -> C40");
  nearlyEqual(ctx.convertValue(72.5, "kUltra", "ek43"), 9.5, 0.2, "K 72.5 -> EK43");
});

test("roundtrip consistency on overlapping calibrated ranges", () => {
  const ctx = loadConverterContext();

  for (let c = 0; c <= 40; c++) {
    const roundtrip = ctx.convertValue(ctx.convertValue(c, "c40", "kUltra"), "kUltra", "c40");
    nearlyEqual(roundtrip, c, 1, `C40 roundtrip input=${c}`);
  }

  for (let k = 0; k <= 100; k += 1) {
    const roundtrip = ctx.convertValue(ctx.convertValue(k, "kUltra", "c40"), "c40", "kUltra");
    nearlyEqual(roundtrip, k, 2, `K<->C40 roundtrip input=${k}`);
  }

  for (let e = 0; e <= 16; e += 0.1) {
    const rounded = Number(e.toFixed(1));
    const roundtrip = ctx.convertValue(ctx.convertValue(rounded, "ek43", "kUltra"), "kUltra", "ek43");
    nearlyEqual(roundtrip, rounded, 0.2, `EK43 roundtrip input=${rounded}`);
  }

  for (let k = 24; k <= 100; k += 1) {
    const roundtrip = ctx.convertValue(ctx.convertValue(k, "kUltra", "ek43"), "ek43", "kUltra");
    nearlyEqual(roundtrip, k, 2, `K<->EK43 roundtrip input=${k}`);
  }
});

test("full-range coverage: outputs are finite and clamped to target range", () => {
  const ctx = loadConverterContext();
  const grinders = {
    c40: { min: 0, max: 40 },
    kUltra: { min: 0, max: 150 },
    ek43: { min: 0, max: 16 },
  };

  for (const [source, sourceRange] of Object.entries(grinders)) {
    for (const [target, targetRange] of Object.entries(grinders)) {
      for (const value of [sourceRange.min, sourceRange.max]) {
        const out = ctx.convertValue(value, source, target);
        assert.ok(Number.isFinite(out), `${source}->${target} value=${value} should be finite`);
        assert.ok(
          out >= targetRange.min && out <= targetRange.max,
          `${source}->${target} value=${value} out=${out} should be clamped to [${targetRange.min}, ${targetRange.max}]`
        );
      }
    }
  }
});

test("non-overlapping K-Ultra tails are intentionally non-reversible when mapped via EK43", () => {
  const ctx = loadConverterContext();
  const lowTailBack = ctx.convertValue(ctx.convertValue(0, "kUltra", "ek43"), "ek43", "kUltra");
  const highTailBack = ctx.convertValue(ctx.convertValue(150, "kUltra", "ek43"), "ek43", "kUltra");

  assert.equal(lowTailBack, 24);
  assert.equal(highTailBack, 100);
});
