import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG_BY_ID } from "./catalog.ts";
import { estimateAlcoholMl, estimateBalance, formatAmount, validateRecipe } from "./recipe.ts";

describe("parts", () => {
  it("formats parts as jigger fractions", () => {
    const rum = CATALOG_BY_ID.get("rum");
    assert.equal(formatAmount({ ingredient: "rum", amount: 1.5 }, rum), "1½ parts");
    assert.equal(formatAmount({ ingredient: "rum", amount: 1 }, rum), "1 part");
    assert.equal(formatAmount({ ingredient: "rum", amount: 0.75 }, rum), "¾ part");
    assert.equal(formatAmount({ ingredient: "rum", amount: 2 }, rum), "2 parts");
  });

  it("counts a part as 30ml for strength", () => {
    assert.equal(estimateAlcoholMl([{ ingredient: "vodka", amount: 1.5 }]), 18);
  });

  it("rejects measures a jigger can't pour", () => {
    const issues = validateRecipe([{ ingredient: "vodka", amount: 1.4 }, { ingredient: "soda", amount: "fill" }], "full");
    assert.deepEqual(issues.map((i) => i.kind), ["odd-measure"]);
  });
});

describe("estimateBalance", () => {
  it("tops the glass up with the fill", () => {
    const b = estimateBalance(
      [
        { ingredient: "vodka", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.5 },
        { ingredient: "cola", amount: "fill" },
      ],
      "highball",
    );
    assert.equal(b.volumeMl, 240);
    // 180ml cola at 10.6g/100ml plus a little from the lime.
    assert.ok(b.sugarPct > 7.5 && b.sugarPct < 8.5, String(b.sugarPct));
    assert.ok(b.acidPct > 0.4 && b.acidPct < 0.5, String(b.acidPct));
  });

  it("is sugar-free for spirit and soda", () => {
    const b = estimateBalance([{ ingredient: "whiskey", amount: 1.5 }, { ingredient: "soda", amount: "fill" }], "highball");
    assert.equal(b.sugarPct, 0);
  });
});
