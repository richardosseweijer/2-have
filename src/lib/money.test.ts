import assert from "node:assert/strict";
import test from "node:test";
import { applyMarkup, bpsToInput, markupBpsFromPrices, parsePercentToBps } from "./money.ts";

test("markup is a percentage on top of cost, rounded to the cent", () => {
  assert.equal(applyMarkup(1000, 3500), 1350);
  assert.equal(applyMarkup(1000, 1000), 1100);
  assert.equal(applyMarkup(1000, 0), 1000);
  assert.equal(applyMarkup(1000, -10000), 0);
});

test("a typed sell price is kept as basis points", () => {
  assert.equal(markupBpsFromPrices(1000, 1500), 5000);
  assert.equal(markupBpsFromPrices(0, 1500), null);
  assert.equal(bpsToInput(3500), "35");
  assert.equal(bpsToInput(3550), "35,5");
  assert.equal(parsePercentToBps("35"), 3500);
  assert.equal(parsePercentToBps("35,5"), 3550);
  assert.equal(parsePercentToBps("-10"), -1000);
  assert.equal(parsePercentToBps("nope"), null);
});
