import { CATALOG_BY_ID, type Order } from "@sloptail/shared";
import type { BarState } from "./state.ts";

/** Orders waiting to be made or in progress, oldest first. */
export function queue(state: BarState): Order[] {
  return Object.values(state.orders)
    .filter((o) => o.status === "queued" || o.status === "making")
    .sort((a, b) => a.createdAt - b.createdAt);
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
 * Group queued orders that share a base spirit, mixer and method so one
 * bartender can build several at once. Batches are ordered by their oldest
 * order so nobody starves; within a batch, oldest first.
 *
 * Only *queued* orders are batched; orders already being made are returned by
 * `queue()` separately.
 */
export function batches(state: BarState, maxPerBatch = 3): Batch[] {
  const queued = queue(state).filter((o) => o.status === "queued");
  // key -> list of batches for that key; a new one is opened when the last is full.
  const groups = new Map<string, Order[][]>();
  for (const order of queued) {
    const key = batchKey(order);
    const list = groups.get(key) ?? [];
    const last = list.at(-1);
    if (last && last.length < maxPerBatch) last.push(order);
    else list.push([order]);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .flatMap(([key, list]) => list.map((orders, i) => ({ key: i ? `${key}#${i}` : key, label: batchLabel(orders[0]!), orders })))
    .sort((a, b) => a.orders[0]!.createdAt - b.orders[0]!.createdAt);
}

export function batchKey(order: Order): string {
  const ids = order.proposal.recipe
    .map((r) => CATALOG_BY_ID.get(r.ingredient))
    .filter((i) => i && (i.type === "base" || i.type === "mixer"))
    .map((i) => i!.id)
    .sort();
  return `${order.proposal.method}|${ids.join("+")}`;
}

function batchLabel(order: Order): string {
  const names = order.proposal.recipe
    .map((r) => CATALOG_BY_ID.get(r.ingredient))
    .filter((i) => i && (i.type === "base" || i.type === "mixer"))
    .map((i) => i!.name);
  return `${names.join(" + ") || "misc"} · ${order.proposal.method}`;
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
