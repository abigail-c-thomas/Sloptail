import { z } from "zod";

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export const IngredientType = z.enum(["base", "mixer", "flavoring", "garnish"]);
export type IngredientType = z.infer<typeof IngredientType>;

/** Unit an amount is expressed in. `fill` is handled separately in RecipeItem. */
export const Unit = z.enum(["ml", "dash", "drop", "pump", "barspoon", "piece"]);
export type Unit = z.infer<typeof Unit>;

export const Ingredient = z.object({
  id: z.string(),
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

export const Method = z.enum(["build", "shake", "stir"]);
export type Method = z.infer<typeof Method>;

export const Glass = z.enum(["highball", "rocks", "coupe", "wine"]);
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

export const UserRequest = z.object({
  strength: Strength,
  adventurousness: Adventurousness,
  prompt: z.string().max(500),
});
export type UserRequest = z.infer<typeof UserRequest>;

// ---------------------------------------------------------------------------
// What the model proposes
// ---------------------------------------------------------------------------

export const Proposal = z.object({
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(400),
  recipe: Recipe,
  method: Method,
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
  claimedBy: z.string().optional(),
  claimedAt: z.number().optional(),
  readyAt: z.number().optional(),
  collectedAt: z.number().optional(),
  cancelledAt: z.number().optional(),
  cancelReason: z.string().optional(),
});
export type Order = z.infer<typeof Order>;

// ---------------------------------------------------------------------------
// API payloads (user-facing)
// ---------------------------------------------------------------------------

export const ProposeBody = z.object({
  userId: z.string(),
  userName: z.string().min(1).max(40),
  request: UserRequest,
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

// ---------------------------------------------------------------------------
// API payloads (bar-facing)
// ---------------------------------------------------------------------------

export const OutOfBody = z.object({
  ingredient: z.string(),
  available: z.boolean(),
});
export type OutOfBody = z.infer<typeof OutOfBody>;

export const ClaimBody = z.object({
  bartender: z.string().min(1).max(40),
});
export type ClaimBody = z.infer<typeof ClaimBody>;
