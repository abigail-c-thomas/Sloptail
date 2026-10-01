import { z } from "zod";

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export const IngredientType = z.enum(["base", "mixer", "flavoring", "garnish"]);
export type IngredientType = z.infer<typeof IngredientType>;

/**
 * Unit an amount is expressed in. `fill` is handled separately in RecipeItem.
 * Poured liquids are in parts (1 part = 30ml, one jigger), in quarter steps.
 */
export const Unit = z.enum(["part", "dash", "drop", "pump", "barspoon", "piece"]);
export type Unit = z.infer<typeof Unit>;

export const Ingredient = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes"),
  name: z.string(),
  type: IngredientType,
  /** Short flavor tags, e.g. "bitter", "citrus", "herbal". Used in prompts and for batching. */
  flavor: z.array(z.string()),
  /** Whether the ingredient contains alcohol. Bitters are alcoholic; grenadine is not. */
  alcoholic: z.boolean(),
  /** ABV as a percentage, only meaningful for bases (and alcoholic flavorings). */
  abv: z.number().optional(),
  /** Unit that amounts of this ingredient are measured in. */
  unit: Unit,
  /** Bar-side notes: where it lives, how it's poured. */
  notes: z.string().optional(),
  /** Hard cap per drink in `unit`, for potent things. Validation rejects more. */
  max: z.number().positive().optional(),
  /** Rough sugar content, grams per 100ml. Feeds the sweetness estimate. */
  sugar: z.number().nonnegative().optional(),
  /** Rough acid content (citric-equivalent), grams per 100ml. Feeds the sourness estimate. */
  acid: z.number().nonnegative().optional(),
  /** How much the bar starts with: ml, or pieces for garnishes. Drives the running-out estimate. */
  stock: z.number().nonnegative().optional(),
});
export type Ingredient = z.infer<typeof Ingredient>;

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export const RecipeItem = z.object({
  ingredient: z.string().describe("Ingredient id from the catalog"),
  amount: z
    .union([z.number().positive(), z.literal("fill")])
    .describe("Quantity in the ingredient's unit, or 'fill' to top up the glass"),
});
export type RecipeItem = z.infer<typeof RecipeItem>;

/** Ordered list: the order is the order the bartender should build the drink in. */
export const Recipe = z.array(RecipeItem).min(1);
export type Recipe = z.infer<typeof Recipe>;

/** Everything is built in the glass over ice (house rule: no time to shake). */
export const Glass = z.enum(["highball", "rocks"]);
export type Glass = z.infer<typeof Glass>;

// ---------------------------------------------------------------------------
// What the user asks for
// ---------------------------------------------------------------------------

/**
 * zero: no alcohol at all.
 * trace: no spirits, but a dash of bitters is fine.
 * half: a cocktail at roughly half the usual spirit measure.
 * full: a regular cocktail.
 */
export const Strength = z.enum(["zero", "trace", "half", "full"]);
export type Strength = z.infer<typeof Strength>;

/** 1 = classics only, 2 = get creative, 3 = fuck my shit up. */
export const Adventurousness = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Adventurousness = z.infer<typeof Adventurousness>;

/** Optional flavour dials on the prompt screen. */
export const Level = z.enum(["low", "medium", "high"]);
export type Level = z.infer<typeof Level>;

export const UserRequest = z.object({
  strength: Strength,
  adventurousness: Adventurousness,
  prompt: z.string().max(500),
  sweetness: Level.optional(),
  acidity: Level.optional(),
});
export type UserRequest = z.infer<typeof UserRequest>;

// ---------------------------------------------------------------------------
// What the model proposes
// ---------------------------------------------------------------------------

export const Proposal = z.object({
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(400),
  recipe: Recipe,
  glass: Glass,
});
export type Proposal = z.infer<typeof Proposal>;

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const OrderStatus = z.enum(["queued", "making", "ready", "collected", "cancelled"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const Order = z.object({
  id: z.string(),
  /** Stable per-device id generated client-side. */
  userId: z.string(),
  userName: z.string().min(1).max(40),
  request: UserRequest,
  proposal: Proposal,
  status: OrderStatus,
  createdAt: z.number(),
  claimedAt: z.number().optional(),
  readyAt: z.number().optional(),
  collectedAt: z.number().optional(),
  cancelledAt: z.number().optional(),
  cancelReason: z.string().optional(),
  /** When the bar's printer produced a ticket for it. Cleared to ask for a reprint. */
  printedAt: z.number().optional(),
  /**
   * The ticket drawing: unset while it's being drawn, then done or failed.
   * The SVG itself is stored separately (it's big), keyed by artKey(order).
   */
  art: z.enum(["done", "failed"]).optional(),
});
export type Order = z.infer<typeof Order>;

/** Storage key for an order's drawing. Includes createdAt because ids restart when the bar is reset. */
export function artKey(order: Pick<Order, "id" | "createdAt">): string {
  return `art:${order.id}:${order.createdAt}`;
}

// ---------------------------------------------------------------------------
// API payloads (user-facing)
// ---------------------------------------------------------------------------

export const ProposeBody = z.object({
  userId: z.string(),
  userName: z.string().min(1).max(40),
  request: UserRequest,
  /** Drinks shown to this guest this session but not ordered, newest first, so the next one differs. */
  seen: z.array(Proposal).max(5).optional(),
});
export type ProposeBody = z.infer<typeof ProposeBody>;

export const EditBody = z.object({
  userId: z.string(),
  request: UserRequest,
  proposal: Proposal,
  tweak: z.string().min(1).max(500),
});
export type EditBody = z.infer<typeof EditBody>;

export const SubmitBody = z.object({
  userId: z.string(),
  userName: z.string().min(1).max(40),
  request: UserRequest,
  proposal: Proposal,
});
export type SubmitBody = z.infer<typeof SubmitBody>;

/** Guest confirms they've picked the drink up. userId must match the order's. */
export const CollectBody = z.object({
  userId: z.string(),
});
export type CollectBody = z.infer<typeof CollectBody>;

// ---------------------------------------------------------------------------
// Event setup (admin)
// ---------------------------------------------------------------------------

/** Setups: one to play with while building, a practice run with a smaller bar, then the real thing. */
export const ProfileName = z.enum(["dev", "practice", "real"]);
export type ProfileName = z.infer<typeof ProfileName>;

export const Profile = z.object({
  ingredients: z
    .array(Ingredient)
    // Empty is fine to save (a profile still being set up); it just can't be started.
    .max(80)
    .refine((list) => new Set(list.map((i) => i.id)).size === list.length, "ingredient ids must be unique"),
  /** Receipt printer on the bar's network, e.g. "192.168.1.50" or "192.168.1.50:9100". */
  printerIp: z.string().max(100),
});
export type Profile = z.infer<typeof Profile>;

export const EventConfig = z.object({
  /** Which profile the bar is running. Switching clears all orders. */
  active: ProfileName,
  profiles: z.record(ProfileName, Profile),
});
export type EventConfig = z.infer<typeof EventConfig>;

export const DescribeBody = z.object({
  names: z.array(z.string().trim().min(1).max(100)).min(1).max(80),
});
export type DescribeBody = z.infer<typeof DescribeBody>;

export const StartBody = z.object({ profile: ProfileName });
export type StartBody = z.infer<typeof StartBody>;

// ---------------------------------------------------------------------------
// API payloads (bar-facing)
// ---------------------------------------------------------------------------

export const OutOfBody = z.object({
  ingredient: z.string(),
  available: z.boolean(),
});
export type OutOfBody = z.infer<typeof OutOfBody>;


/** Heartbeat from the print bridge, shown on the bar screen. */
export const PrinterReport = z.object({
  ok: z.boolean(),
  /** Paper low but still printing, etc. */
  warning: z.boolean().default(false),
  message: z.string().max(200),
  /** Tickets waiting in the bridge's queue. */
  pending: z.number().int().min(0).default(0),
});
export type PrinterReport = z.infer<typeof PrinterReport>;
