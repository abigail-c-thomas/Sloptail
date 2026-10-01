import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateConfig } from "./config.ts";
import { EventConfig } from "./types.ts";

const bar = (id: string) => ({ ingredients: [{ id, name: id, type: "base", flavor: [], alcoholic: true, abv: 40, unit: "part" }], printerIp: "10.0.0.1" });

describe("migrateConfig", () => {
  it("turns the old practice profile into dev and starts practice empty", () => {
    const old = { active: "real", profiles: { practice: bar("rum"), real: bar("gin") } };
    const c = EventConfig.parse(migrateConfig(old));
    assert.equal(c.active, "real");
    assert.equal(c.profiles.dev.ingredients[0]?.id, "rum");
    assert.deepEqual(c.profiles.practice, { ingredients: [], printerIp: "" });
    assert.equal(c.profiles.real.ingredients[0]?.id, "gin");
  });

  it("keeps running what was running", () => {
    const old = { active: "practice", profiles: { practice: bar("rum"), real: bar("gin") } };
    assert.equal(EventConfig.parse(migrateConfig(old)).active, "dev");
  });

  it("leaves a current config alone", () => {
    const now = { active: "practice", profiles: { dev: bar("rum"), practice: bar("vodka"), real: bar("gin") } };
    assert.equal(migrateConfig(now), now);
    assert.equal(migrateConfig(undefined), undefined);
  });
});
