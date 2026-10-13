import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextLine, withoutSequels } from "./sequels.ts";

const SEQUELS = { "Rolling at 6pm": "Rolling back at 6:05pm" };
const POOL = ["Rolling at 6pm", "Rolling back at 6:05pm", "Wet dog", "Laundry day"];

describe("sequels", () => {
  it("keeps sequels out of the random pool", () => {
    assert.deepEqual(withoutSequels(POOL, SEQUELS), ["Rolling at 6pm", "Wet dog", "Laundry day"]);
  });

  it("always follows a set-up with its sequel", () => {
    for (const r of [0, 0.5, 0.99]) assert.equal(nextLine("Rolling at 6pm", POOL, SEQUELS, () => r), "Rolling back at 6:05pm");
  });

  it("never picks a sequel at random, or the same line twice running", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(nextLine("Wet dog", POOL, SEQUELS, () => i / 100));
    assert.deepEqual([...seen].sort(), ["Laundry day", "Rolling at 6pm"]);
  });

  it("starts anywhere but a sequel", () => {
    for (let i = 0; i < 100; i++) assert.notEqual(nextLine(undefined, POOL, SEQUELS, () => i / 100), "Rolling back at 6:05pm");
  });
});
