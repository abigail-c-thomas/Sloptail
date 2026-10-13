import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLASSICS, classicsFor } from "./classics.ts";
import { CATALOG, KNOWN_EXTRAS, makeCatalog } from "./catalog.ts";
import { validateRecipe } from "./recipe.ts";

/** Classics may use anything we know how to describe; a bar that lacks it just doesn't offer them. */
const EVERYTHING = makeCatalog([...CATALOG, ...KNOWN_EXTRAS]);

describe("classics", () => {
  for (const c of CLASSICS) {
    it(`${c.id} uses catalog ingredients and fits its strengths`, () => {
      for (const item of c.proposal.recipe) assert.ok(EVERYTHING.byId.has(item.ingredient), item.ingredient);
      for (const strength of c.strengths) {
        const scaled = classicsFor(strength, EVERYTHING).find((x) => x.id === c.id)!;
        assert.deepEqual(validateRecipe(scaled.proposal.recipe, strength, EVERYTHING), [], `${c.id} @ ${strength}`);
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
    const noRumNoPeel = makeCatalog(CATALOG.filter((i) => i.id !== "rum" && i.id !== "citrus-peel"));
    const ids = classicsFor("full", noRumNoPeel).map((c) => c.id);
    assert.ok(!ids.includes("dark-and-stormy"));
    assert.ok(!ids.includes("kalimotxo"), "no red wine in the default bar");
    const mt = classicsFor("full", noRumNoPeel).find((c) => c.id === "mezcal-tonic")!;
    assert.deepEqual(mt.proposal.recipe.map((r) => r.ingredient), ["mezcal", "tonic"]);
  });

  it("keeps it plain: no unusual flavourings, at most one garnish", () => {
    const unusual = new Set(["liquid-smoke", "rose-water", "szechuan-syrup", "celery-syrup", "chilli-syrup", "vegemite", "cream", "pomegranate-molasses"]);
    for (const c of CLASSICS) {
      assert.ok(!c.proposal.recipe.some((r) => unusual.has(r.ingredient)), c.id);
      assert.ok(c.proposal.recipe.filter((r) => EVERYTHING.byId.get(r.ingredient)?.type === "garnish").length <= 1, c.id);
    }
  });
});
