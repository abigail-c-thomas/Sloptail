import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CATALOG, type Proposal } from "@sloptail/shared";
import { FakeClient } from "./client.ts";
import type { PromptContext } from "./prompt.ts";
import { checkSvg, drawArt } from "./art.ts";

const GOOD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="white"/><defs><linearGradient id="g"><stop offset="0" stop-color="#ccc"/></linearGradient></defs><circle cx="128" cy="128" r="80" fill="url(#g)" stroke="black" stroke-width="6"/></svg>`;

describe("checkSvg", () => {
  it("accepts a plain drawing and strips chatter around it", () => {
    const r = checkSvg("Here you go!\n```svg\n" + GOOD + "\n```");
    assert.deepEqual(r, { ok: true, svg: GOOD });
  });

  for (const [label, svg] of [
    ["script", GOOD.replace("</svg>", "<script>alert(1)</script></svg>")],
    ["event handler", GOOD.replace("<circle", '<circle onclick="x()"')],
    ["external href", GOOD.replace("</svg>", '<use href="http://evil/x.svg#a"/></svg>')],
    ["external url()", GOOD.replace("url(#g)", "url(http://evil/a)")],
    ["foreignObject", GOOD.replace("</svg>", "<foreignObject><div/></foreignObject></svg>")],
    ["text", GOOD.replace("</svg>", "<text>hi</text></svg>")],
    ["style", GOOD.replace("<circle", '<circle style="fill:red"')],
    ["wrong viewBox", GOOD.replace("0 0 256 256", "0 0 100 100")],
  ] as const) {
    it(`rejects ${label}`, () => assert.equal(checkSvg(svg).ok, false));
  }

  it("allows local references", () => {
    assert.equal(checkSvg(GOOD.replace("</svg>", '<use href="#g"/></svg>')).ok, true);
  });
});

const ctx: PromptContext = {
  catalog: DEFAULT_CATALOG,
  userName: "Ada",
  request: { strength: "full", adventurousness: 2, prompt: "a storm at sea" },
  unavailable: new Set(),
};
const proposal: Proposal = {
  name: "Squall",
  description: "Rum and ginger.",
  glass: "highball",
  recipe: [{ ingredient: "rum", amount: 1.5 }, { ingredient: "ginger-beer", amount: "fill" }],
};

describe("drawArt", () => {
  it("repairs once with the reasons, then returns the clean SVG", async () => {
    const client = new FakeClient([GOOD.replace("</svg>", "<text>no</text></svg>"), GOOD]);
    const r = await drawArt(ctx, proposal, client);
    assert.equal(r.svg, GOOD);
    assert.equal(r.attempts, 2);
    assert.match(client.requests[1]!.messages.at(-1)!.content, /Elements not allowed: text/);
  });

  it("continues the drink conversation: request, the drink as the model's reply, then the drawing ask", async () => {
    const client = new FakeClient([GOOD]);
    await drawArt(ctx, proposal, client);
    const msgs = client.requests[0]!.messages;
    assert.deepEqual(msgs.map((m) => m.role), ["system", "user", "assistant", "user"]);
    assert.match(msgs[1]!.content, /a storm at sea/);
    assert.equal(msgs[2]!.content, JSON.stringify(proposal));
    assert.match(msgs[3]!.content, /draw a small picture/);
  });

  it("gives up after two bad drawings", async () => {
    await assert.rejects(drawArt(ctx, proposal, new FakeClient(["nope", "still nope"])), /No usable drawing/);
  });
});
