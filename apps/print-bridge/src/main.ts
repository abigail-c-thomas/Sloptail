/**
 * Print bridge: runs on a laptop at the bar, on the same network as the
 * printer. Polls the server for orders that don't have a ticket yet, prints
 * them one at a time (with a gap so each can be torn off), marks them printed,
 * and reports printer health so the bar screen can say "out of paper".
 *
 *   node apps/print-bridge/src/main.ts --printer 192.168.0.50 --token BAR_TOKEN [--url https://…] [--gap 3]
 *   node apps/print-bridge/src/main.ts --printer 192.168.0.50 --test      # one sample ticket, then exit
 *   node apps/print-bridge/src/main.ts --preview --token BAR_TOKEN        # show tickets in the terminal; prints nothing
 *
 * Run one bridge per printer. The server remembers what has been printed, so
 * restarting the bridge doesn't reprint anything; "Reprint" on the bar screen
 * clears the mark and the bridge picks the order up again.
 */
import { parseArgs } from "node:util";
import type { Order } from "@sloptail/shared";
import { EposPrinter, type PrintResult } from "@sloptail/printer";
import { orderTicket } from "@sloptail/ticket";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: process.env.SLOPTAIL_URL ?? "https://sloptail.sloptail-server.workers.dev" },
    token: { type: "string", default: process.env.BAR_TOKEN },
    printer: { type: "string", default: process.env.PRINTER_HOST },
    https: { type: "boolean", default: false },
    gap: { type: "string", default: "3" },
    poll: { type: "string", default: "2" },
    tz: { type: "string" },
    test: { type: "boolean", default: false },
    preview: { type: "boolean", default: false },
  },
});

const base = args.url.replace(/\/$/, "");
const timeZone = args.tz;

function log(...parts: unknown[]) {
  console.log(new Date().toLocaleTimeString("en-GB"), ...parts);
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}/api/bar${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(`${path}: ${data?.error ?? `HTTP ${res.status}`}`);
  return data as T;
}

// --- one-off modes ---------------------------------------------------------

if (args.test) {
  if (!args.printer) fail("--test needs --printer <ip>");
  const printer = new EposPrinter({ host: args.printer, https: args.https });
  const doc = orderTicket(sampleOrder(), { timeZone });
  console.log(doc.toText());
  const r = await printer.print(doc, "test");
  log(r.success ? "✓" : "✗", r.message, r.code ? `(${r.code}, status 0x${r.raw.toString(16)})` : "", r.detail ?? "");
  process.exit(r.success ? 0 : 1);
}

if (!args.token) fail("Needs --token (the BAR_TOKEN) or BAR_TOKEN in the environment.");
if (!args.printer && !args.preview) fail("Needs --printer <ip> (or --preview to just show tickets here).");

// --- the loop ----------------------------------------------------------------

const printer = args.printer
  ? new EposPrinter({ host: args.printer, https: args.https, minIntervalMs: Number(args.gap) * 1000 })
  : null;
const POLL_MS = Number(args.poll) * 1000;
/** Status probe when idle, so the bar hears about "cover open" before the next order. */
const PROBE_MS = 10_000;

/** Orders handed to the printer and not yet confirmed back to the server. */
const inFlight = new Set<string>();
/**
 * Orders we printed moments ago. A poll that was already in flight when we
 * marked one printed can still list it; don't print it twice. (A reprint asked
 * for within this window is simply picked up on a later poll.)
 */
const justPrinted = new Map<string, number>();
const JUST_PRINTED_MS = 10_000;

let last: PrintResult | null = null;
let lastProbe = 0;
let serverDown = false;

async function handle(order: Order) {
  if (!printer) {
    console.log(`\n${orderTicket(order, { timeZone }).toText()}\n`);
    justPrinted.set(order.id, Date.now() + 24 * 3600_000); // preview once per run
    return;
  }
  const r = await printer.print(orderTicket(order, { timeZone }), `order-${order.id}`);
  last = r;
  if (!r.success) {
    log(`✗ #${order.id} ${order.userName}: ${r.message} ${r.code ? `(${r.code}${r.detail ? `: ${r.detail}` : ""})` : ""} Will retry.`);
    return;
  }
  justPrinted.set(order.id, Date.now());
  log(`✓ #${order.id} ${order.userName}: ${order.proposal.name}${r.status.paperNearEnd ? "  (paper low)" : ""}`);
  try {
    await api(`/orders/${order.id}/printed`, {});
  } catch (e) {
    // It printed; the worst case is a duplicate ticket after a restart.
    log(`  couldn't mark #${order.id} printed: ${(e as Error).message}`);
  }
}

async function tick() {
  const now = Date.now();
  for (const [id, at] of justPrinted) if (now - at > JUST_PRINTED_MS) justPrinted.delete(id);

  let orders: Order[];
  try {
    orders = await api<Order[]>("/print-queue");
    if (serverDown) log("Server reachable again.");
    serverDown = false;
  } catch (e) {
    if (!serverDown) log(`Can't reach the server: ${(e as Error).message}`);
    serverDown = true;
    return;
  }

  for (const order of orders) {
    if (inFlight.has(order.id) || justPrinted.has(order.id)) continue;
    inFlight.add(order.id);
    void handle(order).finally(() => inFlight.delete(order.id));
  }

  if (!printer) return;
  if (printer.queued === 0 && now - lastProbe > PROBE_MS) {
    lastProbe = now;
    const r = await printer.status();
    if (last?.success !== r.success || last?.code !== r.code) log(r.success ? "Printer ready." : `Printer: ${r.message}`);
    last = r;
  }
  if (last) {
    const message = last.success ? (last.status.paperNearEnd ? "Paper running low." : "Ready.") : last.message;
    await api("/printer", { ok: last.success, warning: last.status.paperNearEnd, message, pending: printer.queued }).catch(() => {});
  }
}

log(`Sloptail print bridge → ${printer ? printer.url : "terminal preview"}, orders from ${base}`);
for (;;) {
  const started = Date.now();
  await tick();
  await new Promise((r) => setTimeout(r, Math.max(0, POLL_MS - (Date.now() - started))));
}

function sampleOrder(): Order {
  return {
    id: "0",
    userId: "test",
    userName: "Test Print",
    status: "queued",
    createdAt: Date.now(),
    request: { strength: "full", adventurousness: 3, prompt: "something smoky that tastes like a bonfire in an orchard" },
    proposal: {
      name: "Orchard Arson",
      glass: "highball",
      description: "Smoky mezcal lifted by pineapple and a numbing Szechuan tingle; think bonfire, but fruity.",
      recipe: [
        { ingredient: "mezcal", amount: 50 },
        { ingredient: "lime-juice", amount: 15 },
        { ingredient: "szechuan-tincture", amount: 2 },
        { ingredient: "pineapple-juice", amount: 40 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  };
}
