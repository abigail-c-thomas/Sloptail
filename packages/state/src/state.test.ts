import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG, DEFAULT_CATALOG, makeCatalog, type Proposal, type UserRequest } from "@sloptail/shared";
import {
  BOARD_READY_MS,
  StateError,
  batches,
  board,
  collectOwnOrder,
  estimatedOut,
  guestsNamed,
  stockLevels,
  cancelOrder,
  claimOrder,
  createState,
  markCollected,
  markPrinted,
  markReady,
  ordersForUser,
  ordersUsing,
  queue,
  requestReprint,
  toPrint,
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
    { ingredient: "mezcal", amount: 1.5 },
    { ingredient: "tonic", amount: "fill" },
    { ingredient: "citrus-peel", amount: 1 },
  ],
};

const mule: Proposal = {
  name: "Mule",
  description: "vodka ginger beer",
  glass: "highball",
  recipe: [
    { ingredient: "vodka", amount: 1.5 },
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

  it("lets only the guest who ordered mark it collected", () => {
    let { state } = submit(createState(), gt, "u1");
    state = markReady(state, "1", 1);
    assert.throws(() => collectOwnOrder(state, "1", "u2", 2), /No order/);
    assert.equal(collectOwnOrder(state, "1", "u1", 2).orders["1"]?.status, "collected");
  });

  it("lists a user's orders newest first", () => {
    const a = submit(createState(), gt, "u1", 1);
    const b = submit(a.state, mule, "u1", 2);
    const c = submit(b.state, gt, "u2", 3);
    assert.deepEqual(ordersForUser(c.state, "u1").map((o) => o.id), ["2", "1"]);
  });
});

describe("guestsNamed", () => {
  it("finds each guest's latest drink by name, ignoring case and cancelled orders", () => {
    let state = submit(createState(), gt, "u1", 1).state;
    state = submit(state, mule, "u1", 2).state;
    state = submit(state, gt, "u2", 3).state;
    state = cancelOrder(state, "3", "nope", 4);
    state = submit(state, gt, "u3", 5).state;
    assert.deepEqual(guestsNamed(state, " u1 "), [{ userId: "u1", drink: "Mule", orderId: "2", status: "queued" }]);
    assert.deepEqual(guestsNamed(state, "U2"), []);
    assert.deepEqual(guestsNamed(state, "nobody"), []);
  });
});

describe("board", () => {
  it("shows who's queued or being made and who's ready, newest ready first, and drops stale ready orders", () => {
    let state = submit(createState(), gt, "u1", 1).state;
    state = submit(state, mule, "u2", 2).state;
    state = submit(state, gt, "u3", 3).state;
    state = submit(state, mule, "u4", 4).state;
    state = claimOrder(state, "1", "Sam", 10);
    state = markReady(state, "2", 20);
    state = markReady(state, "3", 30);
    const b = board(state, 100);
    assert.deepEqual(b.inProgress, [{ userName: "U1", drink: "M&T" }, { userName: "U4", drink: "Mule" }]);
    assert.deepEqual(b.ready.map((r) => r.userName), ["U3", "U2"]);
    assert.deepEqual(board(state, 25 + BOARD_READY_MS).ready.map((r) => r.userName), ["U3"]);
  });
});

describe("stock", () => {
  it("estimates use per ingredient, fills included, and flags what's run out", () => {
    const catalog = makeCatalog(
      CATALOG.map((i) => (i.id === "mezcal" ? { ...i, stock: 90 } : i.id === "tonic" ? { ...i, stock: 1000 } : i)),
    );
    let state = submit(createState(), gt, "u1", 1).state;
    state = submit(state, gt, "u2", 2).state;
    state = submit(state, gt, "u3", 3).state;
    state = cancelOrder(state, "3", "x", 4);
    // Two drinks: 45ml mezcal each, tonic tops each highball up to 240ml.
    assert.deepEqual(stockLevels(state, catalog), [
      { ingredient: "mezcal", stock: 90, used: 90 },
      { ingredient: "tonic", stock: 1000, used: 390 },
    ]);
    assert.deepEqual(estimatedOut(state, catalog), ["mezcal"]);
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
    const b = batches(s, DEFAULT_CATALOG);
    assert.deepEqual(b.map((x) => x.orders.map((o) => o.id)), [["1", "3"], ["2", "4"]]);
    assert.match(b[0]?.label ?? "", /Vodka/);
  });

  it("caps batch size and spills into a new batch", () => {
    let s = createState();
    for (let i = 0; i < 5; i++) s = submit(s, gt, `u${i}`, i).state;
    const b = batches(s, DEFAULT_CATALOG, 3);
    assert.deepEqual(b.map((x) => x.orders.length), [3, 2]);
  });

  it("excludes orders already being made", () => {
    let s = submit(createState(), gt, "a", 1).state;
    s = submit(s, gt, "b", 2).state;
    s = claimOrder(s, "1", "Sam", 3);
    assert.deepEqual(batches(s, DEFAULT_CATALOG).flatMap((x) => x.orders.map((o) => o.id)), ["2"]);
  });
});

describe("printing", () => {
  it("tracks which live orders still need a ticket", () => {
    let s = createState();
    const a = submitOrder(s, { userId: "u1", userName: "Ada", request, proposal: gt, now: 1 });
    const b = submitOrder(a.state, { userId: "u2", userName: "Bo", request, proposal: gt, now: 2 });
    s = b.state;
    assert.deepEqual(toPrint(s).map((o) => o.id), ["1", "2"]);

    s = markPrinted(s, "1", 10);
    assert.equal(s.orders["1"]!.printedAt, 10);
    assert.equal(s.orders["1"]!.status, "queued");
    assert.deepEqual(toPrint(s).map((o) => o.id), ["2"]);

    s = requestReprint(s, "1");
    assert.deepEqual(toPrint(s).map((o) => o.id), ["1", "2"]);

    s = markReady(s, "2", 20);
    assert.deepEqual(toPrint(s).map((o) => o.id), ["1"]);
    assert.throws(() => markPrinted(s, "nope", 1), StateError);
  });
});
