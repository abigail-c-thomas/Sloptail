import { DurableObject } from "cloudflare:workers";
import type { Order, Proposal } from "@sloptail/shared";
import {
  StateError,
  batches,
  board,
  cancelOrder,
  claimOrder,
  collectOwnOrder,
  createState,
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
  type Board,
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
}

const STORAGE_KEY = "state";

/** Model calls per user per minute, and for the whole bar per minute. In-memory; resets if the DO restarts, which is fine. */
const RATE = { perUser: 8, global: 120, windowMs: 60_000 };

/**
 * The single stateful thing in the system. Holds the pure BarState in memory,
 * persists after every mutation, and exposes the mutations as RPC methods.
 * Everything interesting happens in @sloptail/state; this class only does I/O.
 */
export class BarDO extends DurableObject<Env> {
  private state: BarState = createState();
  private llmCalls = new Map<string, number[]>();

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

  /** A guest's last few ordered drinks, newest first, for the prompt's "make it different" hint. */
  getUserHistory(userId: string, limit = 5): Proposal[] {
    return ordersForUser(this.state, userId)
      .filter((o) => o.status !== "cancelled")
      .slice(0, limit)
      .map((o) => o.proposal);
  }

  getBoard(): Board {
    return board(this.state, Date.now());
  }

  getBarView(): BarView {
    return {
      queue: queue(this.state),
      batches: batches(this.state),
      ready: readyOrders(this.state),
      unavailable: [...this.state.unavailable],
      stats: stats(this.state),
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

  collectedByGuest(id: string, userId: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => collectOwnOrder(s, id, userId, Date.now()), id);
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

  /**
   * Cheap protection for the unauthenticated model endpoints: a leaked URL
   * shouldn't be able to burn OpenRouter credit. Returns false when over limit.
   */
  allowLlmCall(userId: string): boolean {
    const now = Date.now();
    const prune = (arr: number[]) => arr.filter((t) => now - t < RATE.windowMs);
    const mine = prune(this.llmCalls.get(userId) ?? []);
    const all = prune(this.llmCalls.get("*") ?? []);
    if (mine.length >= RATE.perUser || all.length >= RATE.global) return false;
    mine.push(now);
    all.push(now);
    this.llmCalls.set(userId, mine);
    this.llmCalls.set("*", all);
    return true;
  }

  /** Wipe everything. Bar-only, for resetting between rehearsals. */
  async reset(): Promise<void> {
    await this.commit(createState());
  }
}
