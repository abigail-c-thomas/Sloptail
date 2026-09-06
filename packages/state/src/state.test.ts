import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Proposal, UserRequest } from "@sloptail/shared";
import {
  StateError,
  batches,
  cancelOrder,
  claimOrder,
  createState,
  markCollected,
  markReady,
  ordersForUser,
  ordersUsing,
  queue,
  setAvailability,
  submitOrder,
  unclaimOrder,
  type BarState,
} from "./index.ts";

const request: UserRequest = { strength: "full", adventurousness: 2, prompt: "something citrusy" };

const gt: Proposal = {
  name: "M&T",
  description: "mezcal and tonic",
  glass: "highball",
  recipe: [
    { ingredient: "mezcal", amount: 50 },
    { ingredient: "tonic", amount: "fill" },
    { ingredient: "citrus-peel", amount: 1 },
  ],
};

const mule: Proposal = {
  name: "Mule",
  description: "vodka ginger beer",
  glass: "highball",
  recipe: [
    { ingredient: "vodka", amount: 50 },
    { ingredient: "ginger-beer", amount: "fill" },
  ],
};

function submit(state: BarState, proposal: Proposal, userId = "u1", now = 1000) {
  return submitOrder(state, { userId, userName: userId.toUpperCase(), request, proposal, now });
}

describe("orders", () => {
  it("submits and mints sequential ids", () => {
    const a = submit(createState(), gt);
    const b = submit(a.state, mule, "u2", 2000);
    assert.equal(a.order.id, "1");
    assert.equal(b.order.id, "2");
    assert.equal(b.state.nextSeq, 3);
    assert.deepEqual(queue(b.state).map((o) => o.id), ["1", "2"]);
  });

  it("does not mutate the input state", () => {
    const s0 = createState();
    submit(s0, gt);
    assert.deepEqual(s0.orders, {});
    assert.equal(s0.nextSeq, 1);
  });

  it("walks the happy path", () => {
    let { state } = submit(createState(), gt);
    state = claimOrder(state, "1", "Sam", 1100);
    assert.equal(state.orders["1"]?.status, "making");
    assert.equal(state.orders["1"]?.claimedBy, "Sam");
    state = markReady(state, "1", 1200);
    assert.equal(state.orders["1"]?.status, "ready");
    state = markCollected(state, "1", 1300);
    assert.equal(state.orders["1"]?.status, "collected");
    assert.deepEqual(queue(state), []);
  });

  it("allows ready straight from queued", () => {
    const { state } = submit(createState(), gt);
    assert.equal(markReady(state, "1", 1).orders["1"]?.status, "ready");
  });

  it("rejects bad transitions", () => {
    let { state } = submit(createState(), gt);
    state = markReady(state, "1", 1);
    state = markCollected(state, "1", 2);
    assert.throws(() => markReady(state, "1", 3), StateError);
    assert.throws(() => cancelOrder(state, "1", "x", 3), /collected/);
  });

  it("rejects unknown ids", () => {
    assert.throws(() => markReady(createState(), "nope", 1), StateError);
  });

  it("unclaims back to queued and clears the bartender", () => {
    let { state } = submit(createState(), gt);
    state = claimOrder(state, "1", "Sam", 1);
    state = unclaimOrder(state, "1");
    assert.equal(state.orders["1"]?.status, "queued");
    assert.equal(state.orders["1"]?.claimedBy, undefined);
  });

  it("lists a user's orders newest first", () => {
    const a = submit(createState(), gt, "u1", 1);
    const b = submit(a.state, mule, "u1", 2);
    const c = submit(b.state, gt, "u2", 3);
    assert.deepEqual(ordersForUser(c.state, "u1").map((o) => o.id), ["2", "1"]);
  });
});

describe("availability", () => {
  it("blocks submissions that use an unavailable ingredient", () => {
    const state = setAvailability(createState(), "mezcal", false);
    assert.throws(() => submit(state, gt), /mezcal/);
    assert.equal(submit(state, mule).order.id, "1");
  });

  it("toggles idempotently and restocks", () => {
    let state = setAvailability(createState(), "mezcal", false);
    state = setAvailability(state, "mezcal", false);
    assert.deepEqual(state.unavailable, ["mezcal"]);
    state = setAvailability(state, "mezcal", true);
    assert.deepEqual(state.unavailable, []);
  });

  it("finds live orders using an ingredient", () => {
    let { state } = submit(createState(), gt);
    state = submit(state, mule).state;
    state = markReady(state, "1", 5);
    assert.deepEqual(ordersUsing(state, "mezcal"), []);
    assert.deepEqual(ordersUsing(state, "vodka").map((o) => o.id), ["2"]);
  });
});

describe("batches", () => {
  it("groups by base + mixer, oldest batch first", () => {
    let s = submit(createState(), mule, "a", 1).state;
    s = submit(s, gt, "b", 2).state;
    s = submit(s, mule, "c", 3).state;
    s = submit(s, gt, "d", 4).state;
    const b = batches(s);
    assert.deepEqual(b.map((x) => x.orders.map((o) => o.id)), [["1", "3"], ["2", "4"]]);
    assert.match(b[0]?.label ?? "", /Vodka/);
  });

  it("caps batch size and spills into a new batch", () => {
    let s = createState();
    for (let i = 0; i < 5; i++) s = submit(s, gt, `u${i}`, i).state;
    const b = batches(s, 3);
    assert.deepEqual(b.map((x) => x.orders.length), [3, 2]);
  });

  it("excludes orders already being made", () => {
    let s = submit(createState(), gt, "a", 1).state;
    s = submit(s, gt, "b", 2).state;
    s = claimOrder(s, "1", "Sam", 3);
    assert.deepEqual(batches(s).flatMap((x) => x.orders.map((o) => o.id)), ["2"]);
  });
});
