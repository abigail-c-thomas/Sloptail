import { DurableObject } from "cloudflare:workers";
import type { Order } from "@sloptail/shared";
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
  readyOrders,
  setAvailability,
  stats,
  submitOrder,
  unclaimOrder,
  type BarState,
  type Batch,
  type Stats,
  type SubmitInput,
} from "@sloptail/state";
import type { Env } from "./env.ts";

/** Result shape for RPC methods: StateError doesn't survive the RPC boundary intact. */
export type Result<T> = { ok: true; value: T } | { ok: false; code: StateError["code"]; message: string };

export interface BarView {
  queue: Order[];
  batches: Batch[];
  ready: Order[];
  unavailable: string[];
  stats: Stats;
  /** Recently collected, newest first, for the "done" column. */
  recent: Order[];
}

const STORAGE_KEY = "state";

/**
 * The single stateful thing in the system. Holds the pure BarState in memory,
 * persists after every mutation, and exposes the mutations as RPC methods.
 * Everything interesting happens in @sloptail/state; this class only does I/O.
 */
export class BarDO extends DurableObject<Env> {
  private state: BarState = createState();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<BarState>(STORAGE_KEY);
      if (saved) this.state = saved;
    });
  }

  private async commit(next: BarState): Promise<void> {
    this.state = next;
    await this.ctx.storage.put(STORAGE_KEY, next);
  }

  private async mutate<T>(fn: (s: BarState) => { state: BarState; value: T }): Promise<Result<T>> {
    try {
      const { state, value } = fn(this.state);
      await this.commit(state);
      return { ok: true, value };
    } catch (e) {
      if (e instanceof StateError) return { ok: false, code: e.code, message: e.message };
      throw e;
    }
  }

  private async mutateOrder(fn: (s: BarState) => BarState, id: string): Promise<Result<Order>> {
    return this.mutate((s) => {
      const state = fn(s);
      return { state, value: state.orders[id]! };
    });
  }

  // --- reads -------------------------------------------------------------

  getOrder(id: string): Order | null {
    return this.state.orders[id] ?? null;
  }

  getOrdersForUser(userId: string): Order[] {
    return ordersForUser(this.state, userId);
  }

  getUnavailable(): string[] {
    return [...this.state.unavailable];
  }

  /** Names served so far, for the prompt's "don't repeat" hint. */
  getRecentNames(limit = 30): string[] {
    return Object.values(this.state.orders)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((o) => o.proposal.name);
  }

  getBarView(): BarView {
    const recent = Object.values(this.state.orders)
      .filter((o) => o.status === "collected" || o.status === "cancelled")
      .sort((a, b) => (b.collectedAt ?? b.cancelledAt ?? 0) - (a.collectedAt ?? a.cancelledAt ?? 0))
      .slice(0, 10);
    return {
      queue: queue(this.state),
      batches: batches(this.state),
      ready: readyOrders(this.state),
      unavailable: [...this.state.unavailable],
      stats: stats(this.state),
      recent,
    };
  }

  getOrdersUsing(ingredient: string): Order[] {
    return ordersUsing(this.state, ingredient);
  }

  // --- writes ------------------------------------------------------------

  submit(input: Omit<SubmitInput, "now">): Promise<Result<Order>> {
    return this.mutate((s) => {
      const { state, order } = submitOrder(s, { ...input, now: Date.now() });
      return { state, value: order };
    });
  }

  claim(id: string, bartender: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => claimOrder(s, id, bartender, Date.now()), id);
  }

  unclaim(id: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => unclaimOrder(s, id), id);
  }

  ready(id: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => markReady(s, id, Date.now()), id);
  }

  collected(id: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => markCollected(s, id, Date.now()), id);
  }

  cancel(id: string, reason: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => cancelOrder(s, id, reason, Date.now()), id);
  }

  setIngredientAvailable(ingredient: string, available: boolean): Promise<Result<string[]>> {
    return this.mutate((s) => {
      const state = setAvailability(s, ingredient, available);
      return { state, value: [...state.unavailable] };
    });
  }

  /** Wipe everything. Bar-only, for resetting between rehearsals. */
  async reset(): Promise<void> {
    await this.commit(createState());
  }
}
