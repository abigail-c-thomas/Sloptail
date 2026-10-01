import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CATALOG, type Order } from "@sloptail/shared";
import { orderTicket } from "./ticket.ts";

const order: Order = {
  id: "7",
  userId: "u",
  userName: "Ada",
  status: "queued",
  createdAt: Date.UTC(2026, 9, 1, 18, 42),
  request: { strength: "trace", adventurousness: 2, prompt: "" },
  proposal: {
    name: "Tea Party",
    glass: "rocks",
    description: "Cold black tea, honey, lime.",
    recipe: [
      { ingredient: "mint-sprig", amount: 1 },
      { ingredient: "soda", amount: "fill" },
      { ingredient: "black-tea", amount: 2 },
      { ingredient: "honey-syrup", amount: 0.5 },
      { ingredient: "angostura", amount: 2 },
    ],
  },
};

describe("orderTicket", () => {
  const text = orderTicket(order, DEFAULT_CATALOG, { timeZone: "UTC" }).toText();

  it("leads with the name, big", () => {
    assert.match(text.split("\n")[1]!, /A {2}D {2}A/);
    assert.match(text, /order 7 {2}- {2}18:42/);
  });

  it("numbers the build steps in build order, garnish last and unnumbered", () => {
    const steps = text.split("\n").filter((l) => /^( \d| \+) {2}/.test(l));
    assert.deepEqual(
      steps.map((l) => l.replace(/ \.+ .*$/, "").trim()),
      ["1  Black tea (cold)", "2  Buckwheat honey syrup", "3  Angostura bitters", "4  Soda water", "+  Mint sprig"],
    );
    assert.match(steps[3]!, /top up$/);
    for (const l of steps) assert.equal(l.length, 42);
  });

  it("flags the strength so a mocktail isn't mistaken for a cocktail", () => {
    assert.match(text, /Rocks glass, ice +LOW ALCOHOL$/m);
  });

  it("skips the prompt line when the guest didn't type one", () => {
    assert.doesNotMatch(text, /You asked for/);
  });

  it("ends with a cut", () => {
    assert.match(orderTicket(order, DEFAULT_CATALOG).toXml(), /<cut type="feed"\/><\/epos-print>$/);
  });
});
