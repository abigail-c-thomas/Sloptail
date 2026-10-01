import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CATALOG, type Order } from "@sloptail/shared";
import { toBitmap } from "@sloptail/printer";
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
  const text = orderTicket(order, DEFAULT_CATALOG).toText();
  const lines = text.split("\n");

  it("leads with the name, big, then a rule and the drink name", () => {
    assert.match(lines[0]!, /A {2}D {2}A/);
    assert.match(lines[1]!, /^─+$/);
    assert.match(text, /T e a {3}P a r t y/);
  });

  it("lists ingredients in build order without step numbers, each line full width", () => {
    const items = lines.filter((l) => / \.+ /.test(l));
    assert.deepEqual(
      items.map((l) => l.replace(/ \.+ .*$/, "")),
      ["Black tea (cold)", "Buckwheat honey syrup", "Angostura bitters", "Soda water", "Mint sprig"],
    );
    assert.match(items[1]!, / \.5 part$/);
    assert.match(items[3]!, /top up$/);
    for (const l of items) assert.equal(l.length, 40);
  });

  it("skips the prompt when the guest didn't type one", () => {
    assert.doesNotMatch(text, /"/);
  });

  it("cuts a long prompt to three lines", () => {
    const long = { ...order, request: { ...order.request, prompt: "according to all known laws of aviation ".repeat(20) } };
    const t = orderTicket(long, DEFAULT_CATALOG).toText().split("\n");
    const quoted = t.slice(t.findIndex((l) => l.startsWith('"')));
    assert.equal(quoted.filter((l) => l.trim() && !l.includes("(cut)")).length, 3);
    assert.match(quoted[2]!, /\.\.\."$/);
  });

  it("puts the drawing under the drink name when there is one", () => {
    const art = toBitmap(new Uint8Array(64 * 32).fill(0), 64, 32, { dither: "threshold" });
    const rows = orderTicket(order, DEFAULT_CATALOG, { art }).lines();
    const at = rows.findIndex((r) => r.kind === "image");
    const nameRow = rows.findIndex((r) => r.kind === "line" && r.spans.some((s) => s.text.includes("Tea Party")));
    assert.ok(nameRow > 0 && at > nameRow, `${nameRow} ${at}`);
  });

  it("ends with a cut", () => {
    assert.match(orderTicket(order, DEFAULT_CATALOG).toXml(), /<cut type="feed"\/><\/epos-print>$/);
  });
});
