import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG, KNOWN_EXTRAS, findKnownIngredient } from "./catalog.ts";
import { Ingredient } from "./types.ts";

// The real list for the event, pasted as written.
const PLAN = `Rum
Mezcal
Vodka
Whiskey
Dry Vermouth
Sweet vermouth
Wine
Sparkling wine
Non alcoholic spirits
Soda
Ginger beer
Tonic
Coke
Pineapple juice
Black tea
Chamomile / herbal tea?
Lime juice
Agave syrup - diluted if in a pump
Honey (buckwheat?) - diluted if in a pump
Pomegranate molasses? - diluted if in a pump
Angostura
Liquid smoke
Rose water
Szechuan peppercorn - infused in simple syrup
Celery seed - infused in simple syrup
Chilli? - infused in simple syrup
Cream
vegemite?
Mint
Rosemary
Sage
Star anise
Cinnamon stick
Cardamom pod
Citrus peel
Salt rim`;

describe("known ingredients", () => {
  it("knows every ingredient on the event list without asking the model", () => {
    const missing = PLAN.split("\n").filter((n) => !findKnownIngredient(n));
    assert.deepEqual(missing, []);
  });

  it("maps loose names to the right entry", () => {
    assert.equal(findKnownIngredient("Mint")?.id, "mint-sprig");
    assert.equal(findKnownIngredient("Honey (buckwheat?) - diluted if in a pump")?.id, "honey-syrup");
    assert.equal(findKnownIngredient("Szechuan peppercorn - infused in simple syrup")?.id, "szechuan-syrup");
    assert.equal(findKnownIngredient("Unicorn tears"), undefined);
  });

  it("has valid, unique entries", () => {
    const all = [...CATALOG, ...KNOWN_EXTRAS];
    for (const i of all) Ingredient.parse(i);
    assert.equal(new Set(all.map((i) => i.id)).size, all.length);
  });
});
