import type { Order, OrderStatus, Proposal, UserRequest } from "@sloptail/shared";

/**
 * The whole bar, as one immutable value. Every mutation below returns a new
 * state and never touches the input. Persistence and concurrency live in the
 * Durable Object that wraps this; nothing here does I/O.
 */
export interface BarState {
  orders: Readonly<Record<string, Order>>;
  /** Ingredient ids the bar has run out of. */
  unavailable: readonly string[];
  /** Monotonic counter used to mint order ids. */
  nextSeq: number;
}

export function createState(): BarState {
  return { orders: {}, unavailable: [], nextSeq: 1 };
}

export class StateError extends Error {
  constructor(
    public readonly code: "not-found" | "bad-transition" | "unavailable-ingredient",
    message: string,
  ) {
    super(message);
    this.name = "StateError";
  }
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  queued: ["making", "ready", "cancelled"],
  making: ["ready", "queued", "cancelled"],
  ready: ["collected", "making"],
  collected: [],
  cancelled: [],
};

function getOrder(state: BarState, id: string): Order {
  const order = state.orders[id];
  if (!order) throw new StateError("not-found", `No order ${id}`);
  return order;
}

function transition(state: BarState, id: string, to: OrderStatus, patch: Partial<Order>): BarState {
  const order = getOrder(state, id);
  if (!TRANSITIONS[order.status].includes(to)) {
    throw new StateError("bad-transition", `Order ${id} is ${order.status}, cannot become ${to}`);
  }
  return { ...state, orders: { ...state.orders, [id]: { ...order, ...patch, status: to } } };
}

export interface SubmitInput {
  userId: string;
  userName: string;
  request: UserRequest;
  proposal: Proposal;
  now: number;
}

/** Submit an order. Fails if the recipe uses something the bar has run out of. */
export function submitOrder(state: BarState, input: SubmitInput): { state: BarState; order: Order } {
  const unavailable = new Set(state.unavailable);
  for (const item of input.proposal.recipe) {
    if (unavailable.has(item.ingredient)) {
      throw new StateError("unavailable-ingredient", `Out of ${item.ingredient}`);
    }
  }
  const id = String(state.nextSeq);
  const order: Order = {
    id,
    userId: input.userId,
    userName: input.userName,
    request: input.request,
    proposal: input.proposal,
    status: "queued",
    createdAt: input.now,
  };
  return {
    state: { ...state, nextSeq: state.nextSeq + 1, orders: { ...state.orders, [id]: order } },
    order,
  };
}

/** A bartender picks an order up. */
export function claimOrder(state: BarState, id: string, bartender: string, now: number): BarState {
  return transition(state, id, "making", { claimedBy: bartender, claimedAt: now });
}

/** Put a claimed order back in the queue (e.g. bartender got pulled away). */
export function unclaimOrder(state: BarState, id: string): BarState {
  const order = getOrder(state, id);
  const { claimedBy: _b, claimedAt: _a, ...rest } = order;
  return {
    ...state,
    orders: { ...state.orders, [id]: { ...rest, status: "queued" } },
  };
}

/** Drink is on the bar; the user's name gets called. */
export function markReady(state: BarState, id: string, now: number): BarState {
  return transition(state, id, "ready", { readyAt: now });
}

/** User has picked it up. */
export function markCollected(state: BarState, id: string, now: number): BarState {
  return transition(state, id, "collected", { collectedAt: now });
}

export function cancelOrder(state: BarState, id: string, reason: string, now: number): BarState {
  return transition(state, id, "cancelled", { cancelledAt: now, cancelReason: reason });
}

/**
 * Mark an ingredient as (un)available. Does not cancel affected orders
 * automatically; the bar decides that (see `ordersUsing`).
 */
export function setAvailability(state: BarState, ingredient: string, available: boolean): BarState {
  const has = state.unavailable.includes(ingredient);
  if (available && has) return { ...state, unavailable: state.unavailable.filter((i) => i !== ingredient) };
  if (!available && !has) return { ...state, unavailable: [...state.unavailable, ingredient] };
  return state;
}
