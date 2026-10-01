import { pourVolumes, type Catalog, type Order } from "@sloptail/shared";
import type { BarState } from "./state.ts";

/** Orders waiting to be made or in progress, oldest first. */
export function queue(state: BarState): Order[] {
  return Object.values(state.orders)
    .filter((o) => o.status === "queued" || o.status === "making")
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Orders that still need a ticket, oldest first. Only orders nobody has
 * finished yet: a ticket for a drink already on the bar is waste.
 */
export function toPrint(state: BarState): Order[] {
  return queue(state).filter((o) => o.printedAt === undefined);
}

/**
 * Of those, the ones to print now: the drawing is in (or failed), or it's
 * taken longer than `waitMs` and the bar shouldn't be kept waiting for it.
 */
export function readyToPrint(state: BarState, now: number, waitMs: number): Order[] {
  return toPrint(state).filter((o) => o.art !== undefined || now - o.createdAt >= waitMs);
}

/** Live orders still waiting for their drawing, oldest first. */
export function needsArt(state: BarState): Order[] {
  return queue(state).filter((o) => o.art === undefined);
}

/** Orders on the bar waiting to be picked up, oldest first. */
export function readyOrders(state: BarState): Order[] {
  return Object.values(state.orders)
    .filter((o) => o.status === "ready")
    .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));
}

export function ordersForUser(state: BarState, userId: string): Order[] {
  return Object.values(state.orders)
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** A guest who has ordered under some name, identified by their latest drink. */
export interface NamedGuest {
  userId: string;
  drink: string;
  orderId: string;
  status: Order["status"];
}

/**
 * Guests who ordered under this name (case- and space-insensitive), most recent
 * first, so a guest on a new phone can say "that's me" and pick their orders
 * back up. Cancelled orders don't count. Names and drink names only.
 */
export function guestsNamed(state: BarState, name: string, limit = 3): NamedGuest[] {
  const key = name.trim().toLowerCase();
  const latest = new Map<string, Order>();
  for (const o of Object.values(state.orders)) {
    if (o.status === "cancelled" || o.userName.trim().toLowerCase() !== key) continue;
    const prev = latest.get(o.userId);
    if (!prev || o.createdAt > prev.createdAt) latest.set(o.userId, o);
  }
  return [...latest.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((o) => ({ userId: o.userId, drink: o.proposal.name, orderId: o.id, status: o.status }));
}

/** Live orders (not collected/cancelled) that use an ingredient. */
export function ordersUsing(state: BarState, ingredient: string): Order[] {
  return Object.values(state.orders).filter(
    (o) =>
      (o.status === "queued" || o.status === "making") &&
      o.proposal.recipe.some((r) => r.ingredient === ingredient),
  );
}

export function unavailableSet(state: BarState): Set<string> {
  return new Set(state.unavailable);
}

export interface Batch {
  /** What the batch has in common, for display: e.g. "gin + tonic, build". */
  key: string;
  label: string;
  orders: Order[];
}

/**
 * Group queued orders that share a base spirit and mixer so one bartender
 * can build several at once. Batches are ordered by their oldest
 * order so nobody starves; within a batch, oldest first.
 *
 * Only *queued* orders are batched; orders already being made are returned by
 * `queue()` separately.
 */
export function batches(state: BarState, catalog: Catalog, maxPerBatch = 3): Batch[] {
  const queued = queue(state).filter((o) => o.status === "queued");
  // key -> list of batches for that key; a new one is opened when the last is full.
  const groups = new Map<string, Order[][]>();
  for (const order of queued) {
    const key = batchKey(order, catalog);
    const list = groups.get(key) ?? [];
    const last = list.at(-1);
    if (last && last.length < maxPerBatch) last.push(order);
    else list.push([order]);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .flatMap(([key, list]) => list.map((orders, i) => ({ key: i ? `${key}#${i}` : key, label: batchLabel(orders[0]!, catalog), orders })))
    .sort((a, b) => a.orders[0]!.createdAt - b.orders[0]!.createdAt);
}

export function batchKey(order: Order, catalog: Catalog): string {
  const ids = order.proposal.recipe
    .map((r) => catalog.byId.get(r.ingredient))
    .filter((i) => i && (i.type === "base" || i.type === "mixer"))
    .map((i) => i!.id)
    .sort();
  return ids.join("+") || "misc";
}

function batchLabel(order: Order, catalog: Catalog): string {
  const names = order.proposal.recipe
    .map((r) => catalog.byId.get(r.ingredient))
    .filter((i) => i && (i.type === "base" || i.type === "mixer"))
    .map((i) => i!.name);
  return names.join(" + ") || "misc";
}

/** How long a ready order stays on the room screen if nobody taps "Got it". */
export const BOARD_READY_MS = 15 * 60 * 1000;

/** What the room screen shows. Names and drink names only; no recipes or ids. */
export interface Board {
  /** Queued or being made, oldest first. */
  inProgress: { userName: string; drink: string }[];
  ready: { userName: string; drink: string }[];
}

export function board(state: BarState, now: number): Board {
  const entry = (o: Order) => ({ userName: o.userName, drink: o.proposal.name });
  return {
    inProgress: queue(state).map(entry),
    ready: readyOrders(state)
      .filter((o) => now - (o.readyAt ?? 0) < BOARD_READY_MS)
      .reverse()
      .map(entry),
  };
}

export interface StockLevel {
  ingredient: string;
  /** What the bar started with: ml, or pieces for garnishes. */
  stock: number;
  /** Estimated use by every order that hasn't been cancelled, same unit. */
  used: number;
}

/**
 * Rough stock left for every ingredient that has a starting amount. Counts
 * queued orders too: they're promised. Estimates, not inventory.
 */
export function stockLevels(state: BarState, catalog: Catalog): StockLevel[] {
  const used = new Map<string, number>();
  for (const o of Object.values(state.orders)) {
    if (o.status === "cancelled") continue;
    for (const [id, n] of pourVolumes(o.proposal.recipe, o.proposal.glass, catalog)) used.set(id, (used.get(id) ?? 0) + n);
  }
  return catalog.list
    .filter((i) => i.stock !== undefined)
    .map((i) => ({ ingredient: i.id, stock: i.stock!, used: Math.round(used.get(i.id) ?? 0) }));
}

/** Ingredients estimated to have run out; kept out of new proposals. */
export function estimatedOut(state: BarState, catalog: Catalog): string[] {
  return stockLevels(state, catalog)
    .filter((l) => l.used >= l.stock)
    .map((l) => l.ingredient);
}

export interface Stats {
  queued: number;
  making: number;
  ready: number;
  collected: number;
  cancelled: number;
  /** Mean seconds from submit to ready over collected+ready orders. */
  avgWaitSeconds: number | null;
}

export function stats(state: BarState): Stats {
  const s: Stats = { queued: 0, making: 0, ready: 0, collected: 0, cancelled: 0, avgWaitSeconds: null };
  let waitTotal = 0;
  let waitCount = 0;
  for (const o of Object.values(state.orders)) {
    s[o.status]++;
    if (o.readyAt) {
      waitTotal += (o.readyAt - o.createdAt) / 1000;
      waitCount++;
    }
  }
  if (waitCount) s.avgWaitSeconds = waitTotal / waitCount;
  return s;
}
