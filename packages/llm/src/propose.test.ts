import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Proposal } from "@sloptail/shared";
import { FakeClient } from "./client.ts";
import { extractJson } from "./parse.ts";
import { edit, propose, ProposeError } from "./propose.ts";
import type { PromptContext } from "./prompt.ts";

const ctx: PromptContext = {
  userName: "Abigail",
  request: { strength: "full", adventurousness: 2, prompt: "something with mezcal, bit bitter" },
  unavailable: new Set(),
};

const good: Proposal = {
  name: "Quiet Bonfire",
  description: "Smoky, bitter, cold, and a little smug about it.",
  glass: "rocks",
  recipe: [
    { ingredient: "mezcal", amount: 1.25 },
    { ingredient: "sweet-vermouth", amount: 0.75 },
    { ingredient: "angostura", amount: 2 },
    { ingredient: "citrus-peel", amount: 1 },
  ],
};

describe("propose", () => {
  it("returns a valid proposal on the first try", async () => {
    const client = new FakeClient([JSON.stringify(good)]);
    const result = await propose(ctx, client);
    assert.equal(result.proposal.name, "Quiet Bonfire");
    assert.equal(result.attempts.length, 1);
    assert.match(client.requests[0]?.messages[0]?.content ?? "", /- mezcal: Mezcal/);
    assert.match(client.requests[0]?.messages[1]?.content ?? "", /bit bitter/);
  });

  it("tolerates code fences and chatter", async () => {
    const client = new FakeClient(["Here you go!\n```json\n" + JSON.stringify(good) + "\n```\nEnjoy."]);
    const result = await propose(ctx, client);
    assert.equal(result.proposal.glass, "rocks");
  });

  it("enforces per-ingredient maximums", async () => {
    const smoky = { ...good, recipe: [...good.recipe, { ingredient: "liquid-smoke", amount: 5 }] };
    const fixed = { ...good, recipe: [...good.recipe, { ingredient: "liquid-smoke", amount: 1 }] };
    const client = new FakeClient([JSON.stringify(smoky), JSON.stringify(fixed)]);
    const result = await propose(ctx, client);
    assert.match(result.attempts[0]?.problems[0] ?? "", /liquid-smoke.*maximum is 2/);
    assert.equal(result.attempts.length, 2);
  });

  it("repairs an unknown ingredient with feedback", async () => {
    const bad = { ...good, recipe: [{ ingredient: "absinthe", amount: 30 }, ...good.recipe] };
    const client = new FakeClient([JSON.stringify(bad), JSON.stringify(good)]);
    const result = await propose(ctx, client);
    assert.equal(result.attempts.length, 2);
    assert.match(result.attempts[0]?.problems[0] ?? "", /absinthe/);
    assert.match(client.requests[1]?.messages.at(-1)?.content ?? "", /not in the catalog/);
  });

  it("rejects spirits in a mocktail and repairs", async () => {
    const mocktailCtx: PromptContext = { ...ctx, request: { ...ctx.request, strength: "zero" } };
    const fixed: Proposal = {
      ...good,
      recipe: [
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "lime-juice", amount: 0.5 },
      ],
    };
    const client = new FakeClient([JSON.stringify(good), JSON.stringify(fixed)]);
    const result = await propose(mocktailCtx, client);
    assert.match(result.attempts[0]?.problems.join(" ") ?? "", /alcoholic/);
    assert.equal(result.proposal.recipe.length, 2);
  });

  it("gives up after maxRepairs", async () => {
    const client = new FakeClient(["nope", "still nope", "no"]);
    await assert.rejects(propose(ctx, client, { maxRepairs: 2 }), ProposeError);
    assert.equal(client.requests.length, 3);
  });

  it("asks for jigger-friendly measures", async () => {
    const odd = { ...good, recipe: [{ ingredient: "mezcal", amount: 1.2 }, ...good.recipe.slice(1)] };
    const client = new FakeClient([JSON.stringify(odd), JSON.stringify(good)]);
    const result = await propose(ctx, client);
    assert.match(result.attempts[0]?.problems[0] ?? "", /quarter-part/);
    assert.equal(result.attempts.length, 2);
  });

  it("repairs a drink that's the opposite of the requested sweetness", async () => {
    const dryCtx: PromptContext = { ...ctx, request: { ...ctx.request, sweetness: "low" } };
    const sweet: Proposal = {
      ...good,
      glass: "highball",
      recipe: [
        { ingredient: "rum", amount: 1.5 },
        { ingredient: "agave-syrup", amount: 0.5 },
        { ingredient: "cola", amount: "fill" },
      ],
    };
    const client = new FakeClient([JSON.stringify(sweet), JSON.stringify(good)]);
    const result = await propose(dryCtx, client);
    assert.match(result.attempts[0]?.problems[0] ?? "", /low sweetness, but this comes out high/);
    assert.match(client.requests[0]?.messages[0]?.content ?? "", /guest wants sweetness low/);
    assert.match(client.requests[0]?.messages[1]?.content ?? "", /Sweetness: low/);
  });

  it("tells the model what this guest has already had", async () => {
    const client = new FakeClient([JSON.stringify(good)]);
    await propose({ ...ctx, history: [good] }, client);
    assert.match(client.requests[0]?.messages[1]?.content ?? "", /Quiet Bonfire: Mezcal, Sweet vermouth/);
    assert.match(client.requests[0]?.messages[1]?.content ?? "", /clearly different/);
  });

  it("excludes unavailable ingredients from the prompt and rejects their use", async () => {
    const noMezcal: PromptContext = { ...ctx, unavailable: new Set(["mezcal"]) };
    const swapped = { ...good, recipe: [{ ingredient: "vodka", amount: 1.25 }, ...good.recipe.slice(1)] };
    const client = new FakeClient([JSON.stringify(good), JSON.stringify(swapped)]);
    const result = await propose(noMezcal, client);
    assert.doesNotMatch(client.requests[0]?.messages[0]?.content ?? "", /- mezcal:/);
    assert.match(result.attempts[0]?.problems[0] ?? "", /run out/);
    assert.equal(result.proposal.recipe[0]?.ingredient, "vodka");
  });
});

describe("edit", () => {
  it("includes the previous proposal and the tweak", async () => {
    const tweaked = { ...good, name: "Louder Bonfire", recipe: [...good.recipe, { ingredient: "liquid-smoke", amount: 1 }] };
    const client = new FakeClient([JSON.stringify(tweaked)]);
    const result = await edit(ctx, good, "more smoke", client);
    const msgs = client.requests[0]?.messages ?? [];
    assert.match(msgs.at(-2)?.content ?? "", /Quiet Bonfire/);
    assert.match(msgs.at(-1)?.content ?? "", /more smoke/);
    assert.equal(result.proposal.name, "Louder Bonfire");
  });

  it("lets a tweak override the original flavour dials", async () => {
    const sweeter: Proposal = {
      ...good,
      glass: "highball",
      recipe: [
        { ingredient: "rum", amount: 1.5 },
        { ingredient: "agave-syrup", amount: 0.5 },
        { ingredient: "cola", amount: "fill" },
      ],
    };
    const client = new FakeClient([JSON.stringify(sweeter)]);
    const result = await edit({ ...ctx, request: { ...ctx.request, sweetness: "low" } }, good, "much sweeter", client);
    assert.equal(result.attempts.length, 1);
  });
});

describe("extractJson", () => {
  it("handles bare, fenced and embedded JSON", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJson('Sure: {"a":1} hope you like it'), { a: 1 });
    assert.throws(() => extractJson("nothing here"), /No JSON/);
  });
});
