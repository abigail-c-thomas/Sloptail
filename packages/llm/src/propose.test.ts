import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Proposal } from "@sloptail/shared";
import { FakeClient } from "./client.ts";
import { extractJson } from "./parse.ts";
import { edit, propose, ProposeError } from "./propose.ts";
import type { PromptContext } from "./prompt.ts";

const ctx: PromptContext = {
  userName: "Abigail",
  request: { strength: "full", adventurousness: 2, prompt: "something with gin, bit bitter" },
  unavailable: new Set(),
};

const good: Proposal = {
  name: "Quiet Negroni",
  description: "Bitter, cold, and a little smug about it.",
  method: "stir",
  glass: "rocks",
  recipe: [
    { ingredient: "gin", amount: 30 },
    { ingredient: "campari", amount: 30 },
    { ingredient: "sweet-vermouth", amount: 30 },
    { ingredient: "orange-slice", amount: 1 },
  ],
};

describe("propose", () => {
  it("returns a valid proposal on the first try", async () => {
    const client = new FakeClient([JSON.stringify(good)]);
    const result = await propose(ctx, client);
    assert.equal(result.proposal.name, "Quiet Negroni");
    assert.equal(result.attempts.length, 1);
    assert.match(client.requests[0]?.messages[0]?.content ?? "", /- gin: Gin/);
    assert.match(client.requests[0]?.messages[1]?.content ?? "", /bit bitter/);
  });

  it("tolerates code fences and chatter", async () => {
    const client = new FakeClient(["Here you go!\n```json\n" + JSON.stringify(good) + "\n```\nEnjoy."]);
    const result = await propose(ctx, client);
    assert.equal(result.proposal.method, "stir");
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
        { ingredient: "lime-juice", amount: 15 },
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

  it("excludes unavailable ingredients from the prompt and rejects their use", async () => {
    const noGin: PromptContext = { ...ctx, unavailable: new Set(["gin"]) };
    const swapped = { ...good, recipe: [{ ingredient: "vodka", amount: 30 }, ...good.recipe.slice(1)] };
    const client = new FakeClient([JSON.stringify(good), JSON.stringify(swapped)]);
    const result = await propose(noGin, client);
    assert.doesNotMatch(client.requests[0]?.messages[0]?.content ?? "", /- gin:/);
    assert.match(result.attempts[0]?.problems[0] ?? "", /run out/);
    assert.equal(result.proposal.recipe[0]?.ingredient, "vodka");
  });
});

describe("edit", () => {
  it("includes the previous proposal and the tweak", async () => {
    const tweaked = { ...good, name: "Louder Negroni", recipe: [...good.recipe, { ingredient: "orange-bitters", amount: 2 }] };
    const client = new FakeClient([JSON.stringify(tweaked)]);
    const result = await edit(ctx, good, "more orange", client);
    const msgs = client.requests[0]?.messages ?? [];
    assert.match(msgs.at(-2)?.content ?? "", /Quiet Negroni/);
    assert.match(msgs.at(-1)?.content ?? "", /more orange/);
    assert.equal(result.proposal.name, "Louder Negroni");
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
