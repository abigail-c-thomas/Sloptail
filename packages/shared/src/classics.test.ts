import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLASSICS, classicsFor } from "./classics.ts";
import { CATALOG_BY_ID } from "./catalog.ts";
import { validateRecipe } from "./recipe.ts";

describe("classics", () => {
  for (const c of CLASSICS) {
    it(`${c.id} uses catalog ingredients and fits its strengths`, () => {
      for (const item of c.proposal.recipe) assert.ok(CATALOG_BY_ID.has(item.ingredient), item.ingredient);
      for (const strength of c.strengths) {
        const scaled = classicsFor(strength).find((x) => x.id === c.id)!;
        assert.deepEqual(validateRecipe(scaled.proposal.recipe, strength), [], `${c.id} @ ${strength}`);
      }
    });
  }

  it("halves the spirit for half strength", () => {
    const full = classicsFor("full").find((c) => c.id === "dark-and-stormy")!;
    const half = classicsFor("half").find((c) => c.id === "dark-and-stormy")!;
    assert.equal(full.proposal.recipe[0]?.amount, 50);
    assert.equal(half.proposal.recipe[0]?.amount, 25);
  });
});
