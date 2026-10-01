import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CATALOG as C } from "./catalog.ts";
import { buildOrder, estimateAlcoholMl, estimateBalance, formatAmount, validateRecipe } from "./recipe.ts";

describe("parts", () => {
  it("formats parts as jigger fractions", () => {
    const rum = C.byId.get("rum");
    assert.equal(formatAmount({ ingredient: "rum", amount: 1.5 }, rum), "1½ parts");
    assert.equal(formatAmount({ ingredient: "rum", amount: 1 }, rum), "1 part");
    assert.equal(formatAmount({ ingredient: "rum", amount: 0.75 }, rum), "¾ part");
    assert.equal(formatAmount({ ingredient: "rum", amount: 2 }, rum), "2 parts");
  });

  it("formats parts as decimals for the bar", () => {
    const rum = C.byId.get("rum");
    assert.equal(formatAmount({ ingredient: "rum", amount: 1.5 }, rum, { decimal: true }), "1.5 parts");
    assert.equal(formatAmount({ ingredient: "rum", amount: 0.5 }, rum, { decimal: true }), ".5 part");
    assert.equal(formatAmount({ ingredient: "rum", amount: 0.25 }, rum, { decimal: true }), ".25 part");
    const bitters = C.byId.get("angostura");
    assert.equal(formatAmount({ ingredient: "angostura", amount: 2 }, bitters, { decimal: true }), "2 dashes");
    assert.equal(formatAmount({ ingredient: "x", amount: 0.5 }, { ...bitters!, unit: "barspoon" }, { decimal: true }), ".5 barspoon");
    assert.equal(formatAmount({ ingredient: "x", amount: 0.5 }, { ...bitters!, unit: "barspoon" }), "½ barspoon");
  });

  it("counts a part as 30ml for strength", () => {
    assert.equal(estimateAlcoholMl([{ ingredient: "vodka", amount: 1.5 }], C), 18);
  });

  it("rejects measures a jigger can't pour", () => {
    const issues = validateRecipe([{ ingredient: "vodka", amount: 1.4 }, { ingredient: "soda", amount: "fill" }], "full", C);
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
      C,
    );
    assert.equal(b.volumeMl, 240);
    // 180ml cola at 10.6g/100ml plus a little from the lime.
    assert.ok(b.sugarPct > 7.5 && b.sugarPct < 8.5, String(b.sugarPct));
    assert.ok(b.acidPct > 0.4 && b.acidPct < 0.5, String(b.acidPct));
  });

  it("is sugar-free for spirit and soda", () => {
    const b = estimateBalance([{ ingredient: "whiskey", amount: 1.5 }, { ingredient: "soda", amount: "fill" }], "highball", C);
    assert.equal(b.sugarPct, 0);
  });
});

describe("buildOrder", () => {
  it("puts sparkling and top-ups after still ingredients, and garnish last, otherwise keeping order", () => {
    const ordered = buildOrder(
      [
        { ingredient: "mint-sprig", amount: 1 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "rum", amount: 1.5 },
        { ingredient: "soda", amount: 1 },
        { ingredient: "lime-juice", amount: 0.5 },
        { ingredient: "pineapple-juice", amount: "fill" },
        { ingredient: "angostura", amount: 2 },
      ],
      C,
    );
    assert.deepEqual(
      ordered.map((r) => r.ingredient),
      ["rum", "lime-juice", "angostura", "ginger-beer", "soda", "pineapple-juice", "mint-sprig"],
    );
  });
});
