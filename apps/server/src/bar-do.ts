import { DurableObject } from "cloudflare:workers";
import {
  CATALOG,
  EventConfig,
  makeCatalog,
  type Catalog,
  type Ingredient,
  type Order,
  type PrinterReport,
  type Profile,
  type ProfileName,
  type Proposal,
} from "@sloptail/shared";
import {
  StateError,
  batches,
  board,
  cancelOrder,
  claimOrder,
  collectOwnOrder,
  createState,
  estimatedOut,
  markPrinted,
  markReady,
  ordersForUser,
  ordersUsing,
  queue,
  readyOrders,
  requestReprint,
  setAvailability,
  stats,
  stockLevels,
  submitOrder,
  toPrint,
  unclaimOrder,
  type BarState,
  type Batch,
  type Board,
  type Stats,
  type StockLevel,
  type SubmitInput,
} from "@sloptail/state";
import type { Env } from "./env.ts";

/** Result shape for RPC methods: StateError doesn't survive the RPC boundary intact. */
export type Result<T> = { ok: true; value: T } | { ok: false; code: StateError["code"]; message: string };

export interface BarView {
  queue: Order[];
  batches: Batch[];
  ready: Order[];
  /** Marked out by the bar. */
  unavailable: string[];
  stats: Stats;
  /** The active profile's ingredients. */
  catalog: Ingredient[];
  stock: StockLevel[];
  profile: ProfileName;
  /** For the receipt printer. Empty if not set. */
  printerIp: string;
  /** Last report from the print bridge, or null if none has ever checked in. */
  printer: PrinterStatus | null;
}

export interface PrintQueue {
  orders: Order[];
  catalog: Ingredient[];
  /** From the admin screen; the bridge uses it unless told otherwise. */
  printerIp: string;
}

export interface PrinterStatus extends PrinterReport {
  /** When the bridge last reported; the bar screen treats an old one as "bridge down". */
  at: number;
}

export interface AdminView {
  config: EventConfig;
  stats: Stats;
  /** For the active profile. */
  stock: StockLevel[];
}

/** What the worker needs to build a prompt, in one round-trip. */
export interface PromptInputs {
  catalog: Ingredient[];
  unavailable: string[];
  recentNames: string[];
  history: Proposal[];
}

const STORAGE_KEY = "state";
const CONFIG_KEY = "config";

/** Before anything's set up: both profiles get the default bar, and the real one is running. */
function defaultConfig(): EventConfig {
  const profile = (): Profile => ({ ingredients: CATALOG.map((i) => ({ ...i })), printerIp: "" });
  return { active: "real", profiles: { practice: profile(), real: profile() } };
}

/** Model calls per user per minute, and for the whole bar per minute. In-memory; resets if the DO restarts, which is fine. */
const RATE = { perUser: 8, global: 120, windowMs: 60_000 };

/**
 * The single stateful thing in the system. Holds the pure BarState in memory,
 * persists after every mutation, and exposes the mutations as RPC methods.
 * Everything interesting happens in @sloptail/state; this class only does I/O.
 */
export class BarDO extends DurableObject<Env> {
  private state: BarState = createState();
  private config: EventConfig = defaultConfig();
  private catalog: Catalog = makeCatalog(this.config.profiles.real.ingredients);
  private llmCalls = new Map<string, number[]>();
  /** In memory only: a heartbeat, not state worth persisting. */
  private printer: PrinterStatus | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<BarState>(STORAGE_KEY);
      if (saved) this.state = saved;
      const config = EventConfig.safeParse(await ctx.storage.get(CONFIG_KEY));
      if (config.success) this.setConfig(config.data);
    });
  }

  private setConfig(config: EventConfig): void {
    this.config = config;
    this.catalog = makeCatalog(config.profiles[config.active].ingredients);
  }

  private async commitConfig(config: EventConfig): Promise<void> {
    this.setConfig(config);
    await this.ctx.storage.put(CONFIG_KEY, config);
  }

  /** Marked out by the bar, plus anything the stock estimate says has run out. */
  private effectiveUnavailable(): string[] {
    return [...new Set([...this.state.unavailable, ...estimatedOut(this.state, this.catalog)])];
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

  /** The active ingredient list and what's out, for the guest app. */
  getCatalog(): { catalog: Ingredient[]; unavailable: string[] } {
    return { catalog: [...this.catalog.list], unavailable: this.effectiveUnavailable() };
  }

  getPromptInputs(userId: string): PromptInputs {
    return {
      catalog: [...this.catalog.list],
      unavailable: this.effectiveUnavailable(),
      recentNames: this.getRecentNames(),
      history: this.getUserHistory(userId),
    };
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
      batches: batches(this.state, this.catalog),
      ready: readyOrders(this.state),
      unavailable: [...this.state.unavailable],
      stats: stats(this.state),
      catalog: [...this.catalog.list],
      stock: stockLevels(this.state, this.catalog),
      profile: this.config.active,
      printerIp: this.config.profiles[this.config.active].printerIp,
      printer: this.printer,
    };
  }

  /** Everything the print bridge needs in one call: what to print, and how to name the ingredients. */
  getPrintQueue(): PrintQueue {
    return {
      orders: toPrint(this.state),
      catalog: [...this.catalog.list],
      printerIp: this.config.profiles[this.config.active].printerIp,
    };
  }

  getAdminView(): AdminView {
    return { config: this.config, stats: stats(this.state), stock: stockLevels(this.state, this.catalog) };
  }

  getOrdersUsing(ingredient: string): Order[] {
    return ordersUsing(this.state, ingredient);
  }

  // --- writes ------------------------------------------------------------

  submit(input: Omit<SubmitInput, "now">): Promise<Result<Order>> {
    const unknown = input.proposal.recipe.find((r) => !this.catalog.byId.has(r.ingredient));
    if (unknown) {
      return Promise.resolve({ ok: false, code: "unavailable-ingredient", message: `This bar doesn't have ${unknown.ingredient}` });
    }
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

  printed(id: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => markPrinted(s, id, Date.now()), id);
  }

  reprint(id: string): Promise<Result<Order>> {
    return this.mutateOrder((s) => requestReprint(s, id), id);
  }

  reportPrinter(report: PrinterReport): void {
    this.printer = { ...report, at: Date.now() };
  }

  setIngredientAvailable(ingredient: string, available: boolean): Promise<Result<string[]>> {
    if (!this.catalog.byId.has(ingredient)) {
      return Promise.resolve({ ok: false, code: "not-found", message: `Unknown ingredient ${ingredient}` });
    }
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

  /** Wipe every order and out-of-stock mark. Config is kept. */
  async reset(): Promise<void> {
    await this.commit(createState());
  }

  // --- admin -------------------------------------------------------------

  async saveProfile(name: ProfileName, profile: Profile): Promise<AdminView> {
    await this.commitConfig({ ...this.config, profiles: { ...this.config.profiles, [name]: profile } });
    return this.getAdminView();
  }

  /** Switch to a profile and start clean: all orders go. */
  async start(name: ProfileName): Promise<AdminView> {
    await this.commitConfig({ ...this.config, active: name });
    await this.reset();
    return this.getAdminView();
  }
}
