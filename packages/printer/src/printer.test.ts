import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EposPrinter, PrintDocument, parseResponse, printable, spread, wrap } from "./index.ts";

const OK = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><response success="true" code="" status="251658262" battery="0" xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></response></s:Body></s:Envelope>`;
const PAPER_OUT = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><response success="false" code="EPTR_REC_EMPTY" status="${0x80000 | 0x8}" battery="0"/></s:Body></s:Envelope>`;

describe("text helpers", () => {
  it("reduces to printable ASCII", () => {
    assert.equal(printable("José’s “drink” — ½ strength 🍸"), `Jose's "drink" - 1/2 strength `);
    assert.equal(printable("a\nb\tc"), "a\nb c");
    assert.equal(printable("1½ parts, ¾ part"), "1 1/2 parts, 3/4 part");
  });

  it("wraps words and hard-breaks long ones", () => {
    assert.deepEqual(wrap("the quick brown fox", 9), ["the quick", "brown fox"]);
    assert.deepEqual(wrap("abcdefgh ij", 4), ["abcd", "efgh", "ij"]);
    assert.deepEqual(wrap("abcd", 2), ["ab", "cd"]);
    assert.deepEqual(wrap("a\n\nb", 5), ["a", "", "b"]);
  });

  it("spreads columns with leaders and truncates the left", () => {
    assert.equal(spread("Rum", "50 ml", 14), "Rum      50 ml");
    assert.equal(spread("Rum", "50 ml", 14, "."), "Rum .... 50 ml");
    assert.equal(spread("Angostura bitters", "2 dashes", 16), "Angost. 2 dashes");
  });
});

describe("PrintDocument", () => {
  it("emits full style up front and only changes afterwards", () => {
    const xml = new PrintDocument().line("hi").line("BIG", { width: 2, em: true }).line("hi").cut().toXml();
    assert.match(xml, /^<epos-print xmlns="http:\/\/www\.epson-pos\.com\/schemas\/2011\/03\/epos-print">/);
    assert.match(xml, /<text font="font_a" width="1" height="1" em="false" ul="false" reverse="false" align="left"\/>/);
    assert.match(xml, /<text>hi&#10;<\/text><text width="2" em="true"\/><text>BIG&#10;<\/text><text width="1" em="false"\/><text>hi&#10;<\/text><cut type="feed"\/>/);
  });

  it("lays out lines with their tallest text and the line's alignment", () => {
    const rows = new PrintDocument().text("a").text("B", { height: 2 }).line().feed(1).line("c", { align: "center" }).cut().lines();
    assert.deepEqual(
      rows.map((r) => (r.kind === "cut" ? "cut" : `${r.align}:${r.height}:${r.spans.map((s) => s.text).join("|")}`)),
      ["left:48:a|B", "left:30:", "center:30:c", "cut"],
    );
  });

  it("draws rules as underlined spaces", () => {
    const [row] = new PrintDocument().rule().lines();
    assert.ok(row?.kind === "line" && row.spans[0]!.style.ul && row.spans[0]!.text === " ".repeat(42));
  });

  it("escapes markup", () => {
    assert.match(new PrintDocument().text(`<a & "b">`).toXml(), /&lt;a &amp; &quot;b&quot;&gt;/);
  });

  it("knows its line width", () => {
    const d = new PrintDocument();
    assert.equal(d.cols(), 42);
    assert.equal(d.cols({ width: 2 }), 21);
    assert.equal(d.cols({ font: "font_b" }), 56);
  });

  it("rejects out-of-range sizes", () => {
    assert.throws(() => new PrintDocument().text("x", { width: 9 }), RangeError);
  });
});

describe("parseResponse", () => {
  it("reads success, code and status", () => {
    assert.deepEqual(parseResponse(OK), { success: true, code: "", raw: 251658262 });
    assert.deepEqual(parseResponse(PAPER_OUT), { success: false, code: "EPTR_REC_EMPTY", raw: 0x80008 });
    assert.equal(parseResponse("<html>nope</html>"), null);
  });
});

/** A printer whose clock only moves when someone sleeps, and which records what it was sent. */
function fakePrinter(reply: string | Error = OK, minIntervalMs = 3000) {
  let t = 1000;
  const sent: { at: number; url: string; body: string; headers: Record<string, string> }[] = [];
  const printer = new EposPrinter({
    host: "10.0.0.5",
    minIntervalMs,
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ at: t, url, body: String(init.body), headers: init.headers as Record<string, string> });
      t += 500; // printing takes a moment
      if (reply instanceof Error) throw reply;
      return new Response(reply);
    }) as typeof fetch,
  });
  return { printer, sent };
}

describe("EposPrinter", () => {
  it("posts a SOAP envelope to the ePOS service", async () => {
    const { printer, sent } = fakePrinter();
    const r = await printer.print(new PrintDocument().line("hello"), "order-1");
    assert.equal(r.success, true);
    assert.equal(r.message, "Printed.");
    assert.equal(sent[0]!.url, "http://10.0.0.5/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000");
    assert.equal(sent[0]!.headers.SOAPAction, '""');
    assert.match(sent[0]!.body, /<s:Envelope .*<printjobid>order-1<\/printjobid>.*<s:Body><epos-print .*hello.*<\/s:Body><\/s:Envelope>$/);
  });

  it("leaves at least minIntervalMs between the end of one print and the start of the next", async () => {
    const { printer, sent } = fakePrinter();
    const results = await Promise.all([printer.print("<a/>"), printer.print("<b/>"), printer.print("<c/>")]);
    assert.ok(results.every((r) => r.success));
    assert.deepEqual(
      sent.map((s) => s.at),
      [1000, 1500 + 3000, 5000 + 3000],
    );
    assert.equal(printer.queued, 0);
  });

  it("does not delay status checks", async () => {
    const { printer, sent } = fakePrinter();
    await printer.print("<a/>");
    await printer.status();
    assert.equal(sent[1]!.at, 1500);
  });

  it("reports printer errors in plain words", async () => {
    const { printer } = fakePrinter(PAPER_OUT);
    const r = await printer.print("<a/>");
    assert.equal(r.success, false);
    assert.equal(r.status.paperEnd, true);
    assert.equal(r.message, "Printer is out of paper.");
  });

  it("resolves (not rejects) when the printer is unreachable, and keeps going", async () => {
    const { printer } = fakePrinter(new TypeError("fetch failed"));
    const r = await printer.print("<a/>");
    assert.equal(r.code, "UNREACHABLE");
    assert.equal(r.status.offline, true);
    assert.equal((await printer.print("<b/>")).code, "UNREACHABLE");
  });
});
