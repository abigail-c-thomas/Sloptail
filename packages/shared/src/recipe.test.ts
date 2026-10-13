import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG, DEFAULT_CATALOG as C, KNOWN_EXTRAS, makeCatalog } from "./catalog.ts";
import { buildOrder, estimateAlcoholMl, estimateBalance, flavourMisses, flavourMissNote, formatAmount, isStrong, validateRecipe } from "./recipe.ts";

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
  it("follows the bar: salt rim, spirits, wine, mixers and cream (top-ups last), bitters, pumps, Vegemite, garnish", () => {
    const ordered = buildOrder(
      [
        { ingredient: "mint-sprig", amount: 1 },
        { ingredient: "vegemite", amount: 0.25 },
        { ingredient: "chilli-syrup", amount: 1 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "angostura", amount: 2 },
        { ingredient: "black-tea", amount: 1 },
        { ingredient: "cream", amount: 0.5 },
        { ingredient: "dry-vermouth", amount: 0.5 },
        { ingredient: "rum", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.5 },
        { ingredient: "salt-rim", amount: 1 },
      ],
      makeCatalog([...CATALOG, ...KNOWN_EXTRAS]),
    );
    assert.deepEqual(
      ordered.map((r) => r.ingredient),
      ["salt-rim", "rum", "dry-vermouth", "black-tea", "cream", "ginger-beer", "angostura", "chilli-syrup", "lime-juice", "vegemite", "mint-sprig"],
    );
  });
});

describe("spice", () => {
  const mule = [
    { ingredient: "vodka", amount: 1.5 },
    { ingredient: "ginger-beer", amount: "fill" as const },
  ];
  const vodkaSoda = [
    { ingredient: "vodka", amount: 1.5 },
    { ingredient: "soda", amount: "fill" as const },
  ];
  const bitters = [...vodkaSoda, { ingredient: "angostura", amount: 2 }];

  it("high wants something hot in it; low wants nothing hot", () => {
    assert.deepEqual(flavourMisses(mule, "highball", { spice: "high" }, C), []);
    assert.equal(flavourMissNote(flavourMisses(vodkaSoda, "highball", { spice: "high" }, C)), "Closest the bar can do: less spicy than you asked for.");
    assert.equal(flavourMissNote(flavourMisses(mule, "highball", { spice: "low" }, C)), "Closest the bar can do: spicier than you asked for.");
    assert.deepEqual(flavourMisses(mule, "highball", { spice: "medium" }, C), []);
  });

  it("doesn't count clove-ish bitters as heat", () => {
    assert.equal(flavourMisses(bitters, "highball", { spice: "high" }, C).length, 1);
  });
});

describe("isStrong", () => {
  it("picks out the flavourings that take over a drink, not the everyday ones or garnishes", () => {
    const all = [...C.list, ...KNOWN_EXTRAS];
    const strong = (id: string) => isStrong(all.find((i) => i.id === id)!);
    for (const id of ["szechuan-syrup", "celery-syrup", "chilli-syrup", "vegemite", "liquid-smoke", "rose-water"]) assert.ok(strong(id), id);
    for (const id of ["lime-juice", "agave-syrup", "angostura", "cream", "sage-leaf", "rum"]) assert.ok(!strong(id), id);
  });
});
