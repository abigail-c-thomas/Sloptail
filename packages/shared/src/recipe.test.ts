import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrder } from "./recipe.ts";

describe("buildOrder", () => {
  it("puts sparkling and top-ups after still ingredients, and garnish last, otherwise keeping order", () => {
    const ordered = buildOrder([
      { ingredient: "mint-sprig", amount: 1 },
      { ingredient: "ginger-beer", amount: "fill" },
      { ingredient: "rum", amount: 50 },
      { ingredient: "soda", amount: 40 },
      { ingredient: "lime-juice", amount: 15 },
      { ingredient: "pineapple-juice", amount: "fill" },
      { ingredient: "angostura", amount: 2 },
    ]);
    assert.deepEqual(
      ordered.map((r) => r.ingredient),
      ["rum", "lime-juice", "angostura", "ginger-beer", "soda", "pineapple-juice", "mint-sprig"],
    );
  });
});
