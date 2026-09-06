import type { Ingredient } from "./types.ts";

/**
 * The bar. Source: Sloptail/Ingredients.md (Abigail's current plan).
 * Single source of truth for what the model may use and what the bar screen shows.
 *
 * House rules baked in here: everything is built in the glass, so nothing needs
 * a shaker; potent flavourings carry a `max` so the model can't drown a drink.
 */
export const CATALOG: Ingredient[] = [
  // --- Bases ------------------------------------------------------------
  { id: "rum", name: "Rum", type: "base", flavor: ["sweet", "molasses", "warm"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "mezcal", name: "Mezcal", type: "base", flavor: ["smoky", "agave", "earthy"], alcoholic: true, abv: 45, unit: "ml" },
  { id: "vodka", name: "Vodka", type: "base", flavor: ["neutral", "clean"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "whiskey", name: "Whiskey", type: "base", flavor: ["oak", "vanilla", "warm", "grain"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "sweet-vermouth", name: "Sweet vermouth", type: "base", flavor: ["herbal", "sweet", "wine", "bitter"], alcoholic: true, abv: 16, unit: "ml", notes: "TBC whether we stock it" },

  // --- Mixers ------------------------------------------------------------
  { id: "soda", name: "Soda water", type: "mixer", flavor: ["neutral", "sparkling"], alcoholic: false, unit: "ml" },
  { id: "ginger-beer", name: "Ginger beer", type: "mixer", flavor: ["spicy", "ginger", "sparkling", "sweet"], alcoholic: false, unit: "ml" },
  { id: "tonic", name: "Tonic water", type: "mixer", flavor: ["bitter", "quinine", "sparkling"], alcoholic: false, unit: "ml" },
  { id: "cola", name: "Coke", type: "mixer", flavor: ["sweet", "caramel", "sparkling"], alcoholic: false, unit: "ml" },
  { id: "pineapple-juice", name: "Pineapple juice", type: "mixer", flavor: ["tropical", "sweet", "fruity"], alcoholic: false, unit: "ml" },
  { id: "black-tea", name: "Black tea (cold)", type: "mixer", flavor: ["tannic", "malty", "dry"], alcoholic: false, unit: "ml", notes: "Brewed strong, chilled" },
  { id: "herbal-tea", name: "Chamomile tea (cold)", type: "mixer", flavor: ["floral", "honeyed", "gentle"], alcoholic: false, unit: "ml", notes: "Brewed strong, chilled" },

  // --- Flavorings --------------------------------------------------------
  { id: "lime-juice", name: "Lime juice", type: "flavoring", flavor: ["sour", "citrus"], alcoholic: false, unit: "ml", max: 30 },
  { id: "agave-syrup", name: "Agave syrup", type: "flavoring", flavor: ["sweet", "clean"], alcoholic: false, unit: "ml", max: 25 },
  { id: "honey-syrup", name: "Buckwheat honey syrup", type: "flavoring", flavor: ["sweet", "dark", "malty", "floral"], alcoholic: false, unit: "ml", max: 25 },
  { id: "pomegranate-molasses", name: "Pomegranate molasses", type: "flavoring", flavor: ["tart", "sweet", "sticky", "fruity"], alcoholic: false, unit: "barspoon", max: 3 },
  { id: "angostura", name: "Angostura bitters", type: "flavoring", flavor: ["bitter", "spice", "clove"], alcoholic: true, abv: 45, unit: "dash", max: 4 },
  { id: "liquid-smoke", name: "Liquid smoke", type: "flavoring", flavor: ["smoky", "savoury"], alcoholic: false, unit: "drop", max: 2, notes: "Overpowering. 1 drop is plenty." },
  { id: "rose-water", name: "Rose water", type: "flavoring", flavor: ["floral", "perfumed"], alcoholic: false, unit: "drop", max: 3, notes: "Goes soapy fast." },
  { id: "szechuan-tincture", name: "Szechuan peppercorn tincture", type: "flavoring", flavor: ["numbing", "citrus", "spice"], alcoholic: true, abv: 40, unit: "drop", max: 4 },
  { id: "celery-tincture", name: "Celery seed tincture", type: "flavoring", flavor: ["savoury", "green", "vegetal"], alcoholic: true, abv: 40, unit: "drop", max: 4 },
  { id: "wine-tannin", name: "Wine tannin solution", type: "flavoring", flavor: ["dry", "astringent", "structure"], alcoholic: false, unit: "drop", max: 4, notes: "Adds grip and dryness, no flavour of its own" },
  { id: "lactic-acid", name: "Lactic acid solution", type: "flavoring", flavor: ["soft-sour", "creamy", "yoghurt"], alcoholic: false, unit: "drop", max: 6, notes: "Rounder than citrus; use instead of or alongside lime" },
  { id: "saline-solution", name: "Saline solution", type: "flavoring", flavor: ["salty", "savoury"], alcoholic: false, unit: "drop", max: 4 },

  // --- Garnishes ---------------------------------------------------------
  { id: "mint-sprig", name: "Mint sprig", type: "garnish", flavor: ["herbal", "fresh"], alcoholic: false, unit: "piece", max: 2 },
  { id: "rosemary-sprig", name: "Rosemary sprig", type: "garnish", flavor: ["herbal", "piney"], alcoholic: false, unit: "piece", max: 1 },
  { id: "sage-leaf", name: "Sage leaf", type: "garnish", flavor: ["herbal", "savoury"], alcoholic: false, unit: "piece", max: 2 },
  { id: "star-anise", name: "Star anise", type: "garnish", flavor: ["anise", "warm-spice"], alcoholic: false, unit: "piece", max: 1 },
  { id: "cinnamon-stick", name: "Cinnamon stick", type: "garnish", flavor: ["warm-spice", "sweet"], alcoholic: false, unit: "piece", max: 1 },
  { id: "cardamom-pod", name: "Cardamom pod", type: "garnish", flavor: ["aromatic", "warm-spice"], alcoholic: false, unit: "piece", max: 2, notes: "Crack it first" },
  { id: "citrus-peel", name: "Citrus peel", type: "garnish", flavor: ["citrus", "aromatic"], alcoholic: false, unit: "piece", max: 1, notes: "Express the oils over the drink" },
];

export const CATALOG_BY_ID: ReadonlyMap<string, Ingredient> = new Map(CATALOG.map((i) => [i.id, i]));

export function getIngredient(id: string): Ingredient | undefined {
  return CATALOG_BY_ID.get(id);
}
