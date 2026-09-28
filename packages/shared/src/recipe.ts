import { CATALOG, CATALOG_BY_ID } from "./catalog.ts";
import type { Glass, Ingredient, Level, Recipe, RecipeItem, Strength } from "./types.ts";

/** One part is one jigger. */
export const ML_PER_PART = 30;

/** Rough volume of one unit of each kind, in ml. Garnishes contribute nothing. */
const ML_PER_UNIT: Record<Ingredient["unit"], number> = {
  part: ML_PER_PART,
  barspoon: 5,
  pump: 7.5,
  dash: 1,
  drop: 0.05,
  piece: 0,
};

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 1.5 -> "1½", 0.25 -> "¼", 0.6 -> "0.6". */
function formatParts(n: number): string {
  const whole = Math.floor(n);
  const frac = FRACTIONS[n - whole];
  if (frac) return whole ? `${whole}${frac}` : frac;
  return String(n);
}

/** Can this ingredient be offered for this strength? Mocktails never see spirits. */
export function allowedForStrength(ing: Ingredient, strength: Strength): boolean {
  if (!ing.alcoholic) return true;
  if (strength === "zero") return false;
  if (strength === "trace") return ing.type === "flavoring";
  return true;
}

/** The pantry as shown to the model: in stock and allowed for the strength. */
export function offeredIngredients(strength: Strength, unavailable: ReadonlySet<string> = new Set()): Ingredient[] {
  return CATALOG.filter((i) => !unavailable.has(i.id) && allowedForStrength(i, strength));
}

/** Human-readable amount, e.g. "1½ parts", "2 dashes", "top up". */
export function formatAmount(item: RecipeItem, ingredient?: Ingredient): string {
  if (item.amount === "fill") return "top up";
  const unit = ingredient?.unit ?? "part";
  const n = item.amount;
  const plural = n === 1 ? "" : "s";
  switch (unit) {
    case "part":
      return `${formatParts(n)} part${n > 1 ? "s" : ""}`;
    case "dash":
      return `${n} dash${n === 1 ? "" : "es"}`;
    case "drop":
    case "pump":
    case "piece":
      return `${n} ${unit}${plural}`;
    case "barspoon":
      return `${n} barspoon${plural}`;
  }
}

/** Rough estimate of pure alcohol in ml, for sanity-checking strength. */
export function estimateAlcoholMl(recipe: Recipe): number {
  let total = 0;
  for (const item of recipe) {
    const ing = CATALOG_BY_ID.get(item.ingredient);
    if (!ing || !ing.alcoholic || item.amount === "fill") continue;
    const abv = ing.abv ?? 0;
    total += (item.amount * ML_PER_UNIT[ing.unit] * abv) / 100;
  }
  return total;
}

/**
 * Alcohol budget per strength, in ml of pure alcohol. House rule: a full
 * drink is a standard cocktail (1½ parts of a 40% spirit = 18ml), never more
 * than a little over that.
 */
export const ALCOHOL_BUDGET: Record<Strength, { min: number; max: number }> = {
  zero: { min: 0, max: 0 },
  trace: { min: 0, max: 1.5 },
  half: { min: 5, max: 12 },
  full: { min: 12, max: 22 },
};

/** Budgets are targets, not tripwires: 2 parts of a 40% spirit shouldn't bounce. */
export const ALCOHOL_TOLERANCE = 0.1;

export type RecipeIssue =
  | { kind: "unknown-ingredient"; ingredient: string }
  | { kind: "unavailable-ingredient"; ingredient: string }
  | { kind: "no-liquid" }
  | { kind: "too-strong"; alcoholMl: number; max: number }
  | { kind: "too-weak"; alcoholMl: number; min: number }
  | { kind: "not-offered"; ingredient: string }
  | { kind: "silly-amount"; ingredient: string; amount: number; max: number }
  | { kind: "odd-measure"; ingredient: string; amount: number };

/**
 * Pure validation of a recipe against the pantry the model was shown and the
 * user's strength. Used both to reject model output and to explain to the
 * model what to fix. Kept deliberately small: mostly "is it on the list".
 */
export function validateRecipe(
  recipe: Recipe,
  strength: Strength,
  unavailable: ReadonlySet<string> = new Set(),
): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  let hasLiquid = false;
  for (const item of recipe) {
    const ing = CATALOG_BY_ID.get(item.ingredient);
    if (!ing) {
      issues.push({ kind: "unknown-ingredient", ingredient: item.ingredient });
      continue;
    }
    if (unavailable.has(ing.id)) issues.push({ kind: "unavailable-ingredient", ingredient: ing.id });
    else if (!allowedForStrength(ing, strength)) issues.push({ kind: "not-offered", ingredient: ing.id });
    if (ing.type !== "garnish") hasLiquid = true;
    if (item.amount !== "fill") {
      const fallback = ing.unit === "part" ? 6 : ing.unit === "drop" ? 6 : ing.unit === "dash" ? 6 : 4;
      const max = ing.max ?? fallback;
      if (item.amount > max) issues.push({ kind: "silly-amount", ingredient: ing.id, amount: item.amount, max });
      // A jigger has quarter marks at best.
      if (ing.unit === "part" && !Number.isInteger(item.amount * 4)) {
        issues.push({ kind: "odd-measure", ingredient: ing.id, amount: item.amount });
      }
    }
  }
  if (!hasLiquid) issues.push({ kind: "no-liquid" });
  const alcoholMl = estimateAlcoholMl(recipe);
  const budget = ALCOHOL_BUDGET[strength];
  if (alcoholMl > budget.max * (1 + ALCOHOL_TOLERANCE)) issues.push({ kind: "too-strong", alcoholMl, max: budget.max });
  if (alcoholMl < budget.min * (1 - ALCOHOL_TOLERANCE)) issues.push({ kind: "too-weak", alcoholMl, min: budget.min });
  return issues;
}

export function describeIssue(issue: RecipeIssue): string {
  switch (issue.kind) {
    case "unknown-ingredient":
      return `"${issue.ingredient}" is not in the catalog. Use only catalog ids.`;
    case "unavailable-ingredient":
      return `"${issue.ingredient}" has run out. Choose something else.`;
    case "no-liquid":
      return "The recipe has no liquid ingredients.";
    case "too-strong":
      return `Too strong: ~${issue.alcoholMl.toFixed(0)}ml pure alcohol, max is ${issue.max}ml. Reduce spirit amounts.`;
    case "too-weak":
      return `Too weak for the requested strength: ~${issue.alcoholMl.toFixed(0)}ml pure alcohol, min is ${issue.min}ml.`;
    case "not-offered":
      return `"${issue.ingredient}" is alcoholic and wasn't on the list for this drink. Use only listed ids.`;
    case "silly-amount":
      return `${issue.amount} of "${issue.ingredient}" is too much; the maximum is ${issue.max}.`;
    case "odd-measure":
      return `${issue.amount} parts of "${issue.ingredient}" can't be measured with a jigger. Use quarter-part steps (0.25, 0.5, 0.75, 1, ...).`;
  }
}

// ---------------------------------------------------------------------------
// Sweetness and sourness
// ---------------------------------------------------------------------------

/** How much liquid a glass holds once topped up over ice, in ml. */
export const FILL_TO_ML: Record<Glass, number> = { highball: 240, rocks: 120 };

export interface Balance {
  /** Total liquid in the glass, in ml. */
  volumeMl: number;
  /** Grams of sugar per 100ml of the finished drink. */
  sugarPct: number;
  /** Grams of acid per 100ml of the finished drink. */
  acidPct: number;
}

/**
 * Rough sugar and acid concentration of the finished drink. "fill" tops the
 * glass up to FILL_TO_ML, shared between fill ingredients. Ignores ice melt;
 * the level bands below are calibrated against the classics with the same
 * assumption.
 */
export function estimateBalance(recipe: Recipe, glass: Glass): Balance {
  let poured = 0;
  let sugar = 0;
  let acid = 0;
  const fills: Ingredient[] = [];
  for (const item of recipe) {
    const ing = CATALOG_BY_ID.get(item.ingredient);
    if (!ing) continue;
    if (item.amount === "fill") {
      fills.push(ing);
      continue;
    }
    const ml = item.amount * ML_PER_UNIT[ing.unit];
    poured += ml;
    sugar += (ml * (ing.sugar ?? 0)) / 100;
    acid += (ml * (ing.acid ?? 0)) / 100;
  }
  const fillMl = fills.length ? Math.max(0, FILL_TO_ML[glass] - poured) / fills.length : 0;
  for (const ing of fills) {
    sugar += (fillMl * (ing.sugar ?? 0)) / 100;
    acid += (fillMl * (ing.acid ?? 0)) / 100;
  }
  const volumeMl = poured + fillMl * fills.length;
  if (volumeMl === 0) return { volumeMl, sugarPct: 0, acidPct: 0 };
  return { volumeMl, sugarPct: (sugar / volumeMl) * 100, acidPct: (acid / volumeMl) * 100 };
}

/** Where low/medium/high sit, in g/100ml of the finished drink: [low below, high above]. */
export const SWEETNESS_BANDS = { low: 4, high: 8 } as const;
export const ACIDITY_BANDS = { low: 0.3, high: 0.6 } as const;

export function levelOf(value: number, bands: { low: number; high: number }): Level {
  return value < bands.low ? "low" : value > bands.high ? "high" : "medium";
}

/**
 * Only flags a drink that's the opposite of what was asked (low vs high).
 * One band off is within the noise of these estimates and not worth a repair
 * round-trip.
 */
export function flavourIssues(
  recipe: Recipe,
  glass: Glass,
  want: { sweetness?: Level | undefined; acidity?: Level | undefined },
): string[] {
  const b = estimateBalance(recipe, glass);
  const issues: string[] = [];
  const check = (name: string, asked: Level | undefined, got: Level, pct: number, bands: { low: number; high: number }) => {
    if (!asked || Math.abs(RANK[asked] - RANK[got]) < 2) return;
    issues.push(
      `The guest asked for ${asked} ${name}, but this comes out ${got} (~${pct.toFixed(1)}g per 100ml; ${asked} is ${
        asked === "low" ? `under ${bands.low}` : `over ${bands.high}`
      }). Rebalance it.`,
    );
  };
  check("sweetness", want.sweetness, levelOf(b.sugarPct, SWEETNESS_BANDS), b.sugarPct, SWEETNESS_BANDS);
  check("sourness", want.acidity, levelOf(b.acidPct, ACIDITY_BANDS), b.acidPct, ACIDITY_BANDS);
  return issues;
}

const RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };
