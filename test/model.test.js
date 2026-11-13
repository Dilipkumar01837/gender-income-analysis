const test = require("node:test");
const assert = require("node:assert");
const FP = require("../public/model.js");
const R = require("../public/data/results.json");

test("JavaScript predictions match the Python model exactly", () => {
  assert.ok(R.checks.length >= 4);
  for (const c of R.checks) {
    const p = FP.predict(R.model, c.input);
    assert.ok(Math.abs(p - c.probability) < 1e-9, `${JSON.stringify(c.input)}: ${p} vs ${c.probability}`);
  }
});

test("probabilities are valid and stars are whole numbers 0-100", () => {
  for (const f of [0, 1]) for (const occ of R.model.occupations) {
    const p = FP.predict(R.model, { female: f, age: 40, hours: 40, edu: 12, occ });
    assert.ok(p > 0 && p < 1);
    const s = FP.stars(p);
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 100);
  }
});

test("results.json has everything the page needs", () => {
  for (const k of ["raw", "shake", "stratified", "stairs", "interaction", "by_education", "model", "ranges", "or_by_education"])
    assert.ok(k in R, "missing " + k);
  assert.equal(R.stairs.length, 4);
  assert.equal(R.by_education.length, 4);
  assert.equal(R.shake.samples.length, 120);
  assert.ok(Math.abs(R.stairs[0].gap - R.raw.gap) < 1e-9, "step 1 gap must equal the raw gap");
});

test("p-value formatting", () => {
  assert.equal(FP.formatP(0.0005, 2000), "less than 0.0005");
  assert.equal(FP.formatP(0.2, 2000), "0.2000");
});
