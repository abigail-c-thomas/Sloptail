import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLASSICS, classicsFor } from "./classics.ts";
import { CATALOG, DEFAULT_CATALOG, makeCatalog } from "./catalog.ts";
import { validateRecipe } from "./recipe.ts";

describe("classics", () => {
  for (const c of CLASSICS) {
    it(`${c.id} uses catalog ingredients and fits its strengths`, () => {
      for (const item of c.proposal.recipe) assert.ok(DEFAULT_CATALOG.byId.has(item.ingredient), item.ingredient);
      for (const strength of c.strengths) {
        const scaled = classicsFor(strength).find((x) => x.id === c.id)!;
        assert.deepEqual(validateRecipe(scaled.proposal.recipe, strength, DEFAULT_CATALOG), [], `${c.id} @ ${strength}`);
      }
    });
  }

  it("halves the spirit for half strength", () => {
    const full = classicsFor("full").find((c) => c.id === "dark-and-stormy")!;
    const half = classicsFor("half").find((c) => c.id === "dark-and-stormy")!;
    assert.equal(full.proposal.recipe[0]?.amount, 1.5);
    assert.equal(half.proposal.recipe[0]?.amount, 0.75);
  });

  it("drops classics the bar can't make and leaves off missing garnishes", () => {
    const noRumNoMint = makeCatalog(CATALOG.filter((i) => i.id !== "rum" && i.id !== "mint-sprig"));
    const ids = classicsFor("full", noRumNoMint).map((c) => c.id);
    assert.ok(!ids.includes("dark-and-stormy"));
    const vls = classicsFor("full", noRumNoMint).find((c) => c.id === "vodka-lime-soda")!;
    assert.deepEqual(vls.proposal.recipe.map((r) => r.ingredient), ["vodka", "lime-juice", "soda"]);
  });
});
