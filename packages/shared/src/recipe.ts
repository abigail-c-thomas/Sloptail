import { CATALOG, CATALOG_BY_ID } from "./catalog.ts";
import type { Ingredient, Recipe, RecipeItem, Strength } from "./types.ts";

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

/** Human-readable amount, e.g. "50 ml", "2 dashes", "fill". */
export function formatAmount(item: RecipeItem, ingredient?: Ingredient): string {
  if (item.amount === "fill") return "top up";
  const unit = ingredient?.unit ?? "ml";
  const n = item.amount;
  const plural = n === 1 ? "" : "s";
  switch (unit) {
    case "ml":
      return `${n} ml`;
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
    // Dashes/drops are tiny; treat a dash as ~1ml and a drop as ~0.05ml.
    const ml = ing.unit === "ml" ? item.amount : ing.unit === "dash" ? item.amount : item.amount * 0.05;
    total += (ml * abv) / 100;
  }
  return total;
}

/**
 * Alcohol budget per strength, in ml of pure alcohol. House rule: a full
 * drink is a standard cocktail (50ml of a 40% spirit = 20ml), never more than
 * a little over that.
 */
export const ALCOHOL_BUDGET: Record<Strength, { min: number; max: number }> = {
  zero: { min: 0, max: 0 },
  trace: { min: 0, max: 1.5 },
  half: { min: 5, max: 12 },
  full: { min: 12, max: 22 },
};

/** Budgets are targets, not tripwires: 50ml of a 45% spirit shouldn't bounce. */
export const ALCOHOL_TOLERANCE = 0.2;

export type RecipeIssue =
  | { kind: "unknown-ingredient"; ingredient: string }
  | { kind: "unavailable-ingredient"; ingredient: string }
  | { kind: "no-liquid" }
  | { kind: "too-strong"; alcoholMl: number; max: number }
  | { kind: "too-weak"; alcoholMl: number; min: number }
  | { kind: "not-offered"; ingredient: string }
  | { kind: "silly-amount"; ingredient: string; amount: number; max: number };

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
      const fallback = ing.unit === "ml" ? 200 : ing.unit === "drop" ? 6 : ing.unit === "dash" ? 6 : 4;
      const max = ing.max ?? fallback;
      if (item.amount > max) issues.push({ kind: "silly-amount", ingredient: ing.id, amount: item.amount, max });
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
  }
}
