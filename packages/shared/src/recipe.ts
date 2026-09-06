import { CATALOG_BY_ID } from "./catalog.ts";
import type { Ingredient, Recipe, RecipeItem, Strength } from "./types.ts";

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

/** Alcohol budget per strength, in ml of pure alcohol. A standard cocktail is ~20ml. */
export const ALCOHOL_BUDGET: Record<Strength, { min: number; max: number }> = {
  zero: { min: 0, max: 0 },
  trace: { min: 0, max: 1.5 },
  half: { min: 5, max: 13 },
  full: { min: 13, max: 26 },
};

export type RecipeIssue =
  | { kind: "unknown-ingredient"; ingredient: string }
  | { kind: "unavailable-ingredient"; ingredient: string }
  | { kind: "no-liquid" }
  | { kind: "too-strong"; alcoholMl: number; max: number }
  | { kind: "too-weak"; alcoholMl: number; min: number }
  | { kind: "spirit-in-mocktail"; ingredient: string }
  | { kind: "silly-amount"; ingredient: string; amount: number };

/**
 * Pure validation of a recipe against the catalog and the user's strength.
 * Used both to reject model output and to explain to the model what to fix.
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
    if (ing.type !== "garnish") hasLiquid = true;
    if ((strength === "zero" || strength === "trace") && ing.alcoholic && ing.type !== "flavoring") {
      issues.push({ kind: "spirit-in-mocktail", ingredient: ing.id });
    }
    if (item.amount !== "fill") {
      const max = ing.unit === "ml" ? 200 : ing.unit === "drop" ? 6 : ing.unit === "dash" ? 6 : 4;
      if (item.amount > max) issues.push({ kind: "silly-amount", ingredient: ing.id, amount: item.amount });
    }
  }
  if (!hasLiquid) issues.push({ kind: "no-liquid" });
  const alcoholMl = estimateAlcoholMl(recipe);
  const budget = ALCOHOL_BUDGET[strength];
  if (alcoholMl > budget.max) issues.push({ kind: "too-strong", alcoholMl, max: budget.max });
  if (alcoholMl < budget.min) issues.push({ kind: "too-weak", alcoholMl, min: budget.min });
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
    case "spirit-in-mocktail":
      return `"${issue.ingredient}" is alcoholic and this is a mocktail. Remove it.`;
    case "silly-amount":
      return `${issue.amount} of "${issue.ingredient}" is far too much.`;
  }
}
