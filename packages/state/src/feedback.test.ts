import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StateError } from "./state.ts";
import { decideFeedback, finishFeedback, newFeedback, startFeedback } from "./feedback.ts";

const fresh = () => newFeedback({ userId: "u1", userName: "Sam", text: "Slider labels overlap", context: "strength" }, "1-a", 1000);

describe("feedback", () => {
  it("starts new", () => {
    assert.equal(fresh().status, "new");
  });

  it("goes new -> todo -> working -> done with a note", () => {
    const todo = decideFeedback(fresh(), "todo", 2000);
    const working = startFeedback(todo, 3000);
    const done = finishFeedback(working, { outcome: "done", note: "Fixed in abc123, deployed" }, 4000);
    assert.deepEqual([todo.status, working.status, done.status], ["todo", "working", "done"]);
    assert.equal(done.note, "Fixed in abc123, deployed");
    assert.equal(done.updatedAt, 4000);
  });

  it("lets the bar change its mind until work starts", () => {
    const wont = decideFeedback(fresh(), "wont", 2000);
    assert.equal(decideFeedback(wont, "todo", 3000).status, "todo");
    assert.equal(decideFeedback(wont, "new", 3000).status, "new");
    const working = startFeedback(decideFeedback(fresh(), "todo", 2000), 3000);
    assert.throws(() => decideFeedback(working, "wont", 4000), StateError);
  });

  it("only starts what the bar said to do", () => {
    assert.throws(() => startFeedback(fresh(), 2000), StateError);
    assert.throws(() => startFeedback(decideFeedback(fresh(), "wont", 2000), 3000), StateError);
    const working = startFeedback(decideFeedback(fresh(), "todo", 2000), 3000);
    assert.equal(startFeedback(working, 4000), working);
  });

  it("can be closed as won't do by the session, straight from todo", () => {
    const closed = finishFeedback(decideFeedback(fresh(), "todo", 2000), { outcome: "wont", note: "Needs a shaker" }, 3000);
    assert.equal(closed.status, "wont");
    assert.equal(closed.note, "Needs a shaker");
  });

  it("can't close what isn't open", () => {
    assert.throws(() => finishFeedback(fresh(), { outcome: "done", note: "" }, 2000), StateError);
    const done = finishFeedback(decideFeedback(fresh(), "todo", 2000), { outcome: "done", note: "" }, 3000);
    assert.throws(() => finishFeedback(done, { outcome: "done", note: "again" }, 4000), StateError);
    assert.equal(done.note, undefined);
  });

  it("drops an old note when re-decided", () => {
    const wont = finishFeedback(decideFeedback(fresh(), "todo", 2000), { outcome: "wont", note: "nope" }, 3000);
    assert.equal(decideFeedback(wont, "todo", 4000).note, undefined);
  });
});
