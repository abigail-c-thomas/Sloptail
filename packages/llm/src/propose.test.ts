import { describe, expect, it } from "vitest";
import type { Proposal } from "@sloptail/shared";
import { FakeClient } from "./client.js";
import { extractJson } from "./parse.js";
import { edit, propose, ProposeError } from "./propose.js";
import type { PromptContext } from "./prompt.js";

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
    expect(result.proposal.name).toBe("Quiet Negroni");
    expect(result.attempts).toHaveLength(1);
    expect(client.requests[0]?.messages[0]?.content).toContain("- gin: Gin");
    expect(client.requests[0]?.messages[1]?.content).toContain("bit bitter");
  });

  it("tolerates code fences and chatter", async () => {
    const client = new FakeClient(["Here you go!\n```json\n" + JSON.stringify(good) + "\n```\nEnjoy."]);
    const result = await propose(ctx, client);
    expect(result.proposal.method).toBe("stir");
  });

  it("repairs an unknown ingredient with feedback", async () => {
    const bad = { ...good, recipe: [{ ingredient: "absinthe", amount: 30 }, ...good.recipe] };
    const client = new FakeClient([JSON.stringify(bad), JSON.stringify(good)]);
    const result = await propose(ctx, client);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.problems[0]).toContain("absinthe");
    const repair = client.requests[1]?.messages.at(-1)?.content;
    expect(repair).toContain("not in the catalog");
  });

  it("rejects spirits in a mocktail and repairs", async () => {
    const mocktailCtx: PromptContext = { ...ctx, request: { ...ctx.request, strength: "zero" } };
    const fixed = {
      ...good,
      recipe: [
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "lime-juice", amount: 15 },
      ],
    };
    const client = new FakeClient([JSON.stringify(good), JSON.stringify(fixed)]);
    const result = await propose(mocktailCtx, client);
    expect(result.attempts[0]?.problems.join(" ")).toMatch(/alcoholic/);
    expect(result.proposal.recipe).toHaveLength(2);
  });

  it("gives up after maxRepairs", async () => {
    const client = new FakeClient(["nope", "still nope", "no"]);
    await expect(propose(ctx, client, { maxRepairs: 2 })).rejects.toBeInstanceOf(ProposeError);
    expect(client.requests).toHaveLength(3);
  });

  it("excludes unavailable ingredients from the prompt and rejects their use", async () => {
    const noGin: PromptContext = { ...ctx, unavailable: new Set(["gin"]) };
    const swapped = { ...good, recipe: [{ ingredient: "vodka", amount: 30 }, ...good.recipe.slice(1)] };
    const client = new FakeClient([JSON.stringify(good), JSON.stringify(swapped)]);
    const result = await propose(noGin, client);
    expect(client.requests[0]?.messages[0]?.content).not.toContain("- gin:");
    expect(result.attempts[0]?.problems[0]).toContain("run out");
    expect(result.proposal.recipe[0]?.ingredient).toBe("vodka");
  });
});

describe("edit", () => {
  it("includes the previous proposal and the tweak", async () => {
    const tweaked = { ...good, name: "Louder Negroni", recipe: [...good.recipe, { ingredient: "orange-bitters", amount: 2 }] };
    const client = new FakeClient([JSON.stringify(tweaked)]);
    const result = await edit(ctx, good, "more orange", client);
    const msgs = client.requests[0]?.messages ?? [];
    expect(msgs.at(-2)?.content).toContain("Quiet Negroni");
    expect(msgs.at(-1)?.content).toContain("more orange");
    expect(result.proposal.name).toBe("Louder Negroni");
  });
});

describe("extractJson", () => {
  it("handles bare, fenced and embedded JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure: {"a":1} hope you like it')).toEqual({ a: 1 });
    expect(() => extractJson("nothing here")).toThrow(/No JSON/);
  });
});
