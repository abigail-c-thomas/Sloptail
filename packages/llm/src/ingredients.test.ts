import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeClient } from "./client.ts";
import { describeIngredients } from "./ingredients.ts";

describe("describeIngredients", () => {
  it("copies known ingredients without asking the model", async () => {
    const client = new FakeClient([]);
    const r = await describeIngredients(["Coke", "lime juice"], client);
    assert.deepEqual(r.ingredients.map((i) => i.id), ["cola", "lime-juice"]);
    assert.equal(client.requests.length, 0);
  });

  it("fills in the rest with the model, keeping the typed name", async () => {
    const reply = {
      ingredients: [
        { id: "campari", name: "campari", type: "base", flavor: ["bitter", "orange"], alcoholic: true, abv: 25, unit: "part", sugar: 24 },
      ],
    };
    const client = new FakeClient([JSON.stringify(reply)]);
    const r = await describeIngredients(["rum", "Campari", "Unicorn tears"], client);
    assert.deepEqual(r.ingredients.map((i) => [i.id, i.name]), [["rum", "Rum"], ["campari", "Campari"]]);
    assert.deepEqual(r.failed, ["Unicorn tears"]);
    assert.match(client.requests[0]?.messages[1]?.content ?? "", /Campari\n- Unicorn tears/);
  });

  it("reports everything as failed if the model returns junk", async () => {
    const r = await describeIngredients(["Campari"], new FakeClient(["no idea"]));
    assert.deepEqual(r, { ingredients: [], failed: ["Campari"] });
    // FakeClient with nothing scripted throws, like a model that's down.
    const down = await describeIngredients(["Coke", "Campari"], new FakeClient([]));
    assert.deepEqual([down.ingredients.map((i) => i.id), down.failed], [["cola"], ["Campari"]]);
  });
});
