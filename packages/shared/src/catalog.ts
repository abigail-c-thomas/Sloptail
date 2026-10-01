import type { Ingredient } from "./types.ts";

/**
 * The default bar. Source: Sloptail/Ingredients.md (Abigail's current plan).
 * Event profiles (set up on /admin) start from this list; the active profile's
 * list is what the model may use and what the bar screen shows.
 *
 * House rules baked in here: everything is built in the glass, so nothing needs
 * a shaker; potent flavourings carry a `max` so the model can't drown a drink.
 */
export const CATALOG: Ingredient[] = [
  // --- Bases ------------------------------------------------------------
  { id: "rum", name: "Rum", type: "base", flavor: ["sweet", "molasses", "warm"], alcoholic: true, abv: 40, unit: "part" },
  { id: "mezcal", name: "Mezcal", type: "base", flavor: ["smoky", "agave", "earthy"], alcoholic: true, abv: 45, unit: "part" },
  { id: "vodka", name: "Vodka", type: "base", flavor: ["neutral", "clean"], alcoholic: true, abv: 40, unit: "part" },
  { id: "whiskey", name: "Whiskey", type: "base", flavor: ["oak", "vanilla", "warm", "grain"], alcoholic: true, abv: 40, unit: "part" },
  { id: "sweet-vermouth", name: "Sweet vermouth", type: "base", flavor: ["herbal", "sweet", "wine", "bitter"], alcoholic: true, abv: 16, unit: "part", sugar: 15, acid: 0.5 },

  // --- Mixers ------------------------------------------------------------
  { id: "soda", name: "Soda water", type: "mixer", flavor: ["neutral", "sparkling"], alcoholic: false, unit: "part" },
  { id: "ginger-beer", name: "Ginger beer", type: "mixer", flavor: ["spicy", "ginger", "sparkling", "sweet"], alcoholic: false, unit: "part", sugar: 10, acid: 0.3 },
  { id: "tonic", name: "Tonic water", type: "mixer", flavor: ["bitter", "quinine", "sparkling"], alcoholic: false, unit: "part", sugar: 8.5, acid: 0.3 },
  { id: "cola", name: "Coke", type: "mixer", flavor: ["sweet", "caramel", "sparkling"], alcoholic: false, unit: "part", sugar: 10.6, acid: 0.1 },
  { id: "pineapple-juice", name: "Pineapple juice", type: "mixer", flavor: ["tropical", "sweet", "fruity"], alcoholic: false, unit: "part", sugar: 10, acid: 0.8 },
  { id: "black-tea", name: "Black tea (cold)", type: "mixer", flavor: ["tannic", "malty", "dry"], alcoholic: false, unit: "part", notes: "Brewed strong, chilled" },
  { id: "herbal-tea", name: "Chamomile tea (cold)", type: "mixer", flavor: ["floral", "honeyed", "gentle"], alcoholic: false, unit: "part", notes: "Brewed strong, chilled" },

  // --- Flavorings --------------------------------------------------------
  { id: "lime-juice", name: "Lime juice", type: "flavoring", flavor: ["sour", "citrus"], alcoholic: false, unit: "part", max: 1, sugar: 1.5, acid: 6 },
  // Syrups are thinned to coffee-syrup consistency and served from pumps (7.5ml a press).
  { id: "agave-syrup", name: "Agave syrup", type: "flavoring", flavor: ["sweet", "clean"], alcoholic: false, unit: "pump", max: 3, sugar: 35, notes: "Diluted for the pump" },
  { id: "honey-syrup", name: "Buckwheat honey syrup", type: "flavoring", flavor: ["sweet", "dark", "malty", "floral"], alcoholic: false, unit: "pump", max: 3, sugar: 40, notes: "Diluted for the pump" },
  { id: "pomegranate-molasses", name: "Pomegranate molasses", type: "flavoring", flavor: ["tart", "sweet", "fruity"], alcoholic: false, unit: "pump", max: 2, sugar: 30, acid: 2.5, notes: "Diluted for the pump" },
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

/**
 * Ingredients we've already worked out but that aren't in the default bar.
 * Not offered to the model unless a profile includes them; they're here so
 * the admin can add them by name without a model call to describe them.
 */
export const KNOWN_EXTRAS: Ingredient[] = [
  { id: "dry-vermouth", name: "Dry vermouth", type: "base", flavor: ["herbal", "dry", "wine", "floral"], alcoholic: true, abv: 18, unit: "part", sugar: 3, acid: 0.5 },
  { id: "wine", name: "Wine", type: "base", flavor: ["dry", "fruity", "wine"], alcoholic: true, abv: 12, unit: "part", sugar: 0.3, acid: 0.6, notes: "Say red or white in the name" },
  { id: "sparkling-wine", name: "Sparkling wine", type: "base", flavor: ["dry", "crisp", "sparkling"], alcoholic: true, abv: 11.5, unit: "part", sugar: 1, acid: 0.7 },
  { id: "non-alcoholic-spirit", name: "Non-alcoholic spirit", type: "base", flavor: ["botanical", "herbal", "dry"], alcoholic: false, unit: "part" },
  // Infused simple syrups, served from pumps like the other syrups.
  { id: "szechuan-syrup", name: "Szechuan peppercorn syrup", type: "flavoring", flavor: ["numbing", "citrus", "spice", "sweet"], alcoholic: false, unit: "pump", max: 2, sugar: 45 },
  { id: "celery-syrup", name: "Celery seed syrup", type: "flavoring", flavor: ["savoury", "green", "vegetal", "sweet"], alcoholic: false, unit: "pump", max: 2, sugar: 45 },
  { id: "chilli-syrup", name: "Chilli syrup", type: "flavoring", flavor: ["hot", "spice", "sweet"], alcoholic: false, unit: "pump", max: 1, sugar: 45, notes: "Taste the batch; heat varies" },
  { id: "cream", name: "Cream", type: "flavoring", flavor: ["rich", "creamy"], alcoholic: false, unit: "part", max: 1, sugar: 3, notes: "Curdles with citrus" },
  { id: "vegemite", name: "Vegemite", type: "flavoring", flavor: ["salty", "umami", "malty"], alcoholic: false, unit: "barspoon", max: 0.5, notes: "Loosen with a little warm water first" },
  { id: "salt-rim", name: "Salt rim", type: "garnish", flavor: ["salty"], alcoholic: false, unit: "piece", max: 1, notes: "Half the rim, so it's optional sip by sip" },
];

/** Other ways people write a known ingredient, as slugs: "Mint" is the mint sprig. */
const ALIASES: Record<string, string> = {
  "chamomile-tea": "herbal-tea",
  "chamomile-herbal-tea": "herbal-tea",
  "honey": "honey-syrup",
  "honey-buckwheat": "honey-syrup",
  "buckwheat-honey": "honey-syrup",
  "szechuan-peppercorn": "szechuan-syrup",
  "celery-seed": "celery-syrup",
  "chilli": "chilli-syrup",
  "chili": "chilli-syrup",
  "chili-syrup": "chilli-syrup",
  "non-alcoholic-spirits": "non-alcoholic-spirit",
  "mint": "mint-sprig",
  "rosemary": "rosemary-sprig",
  "sage": "sage-leaf",
};

export const TYPE_LABEL: Record<Ingredient["type"], string> = {
  base: "Bases",
  mixer: "Mixers",
  flavoring: "Flavourings",
  garnish: "Garnishes",
};

/** An ingredient list plus an id index. Everything that needs to know what's behind the bar takes one. */
export interface Catalog {
  list: readonly Ingredient[];
  byId: ReadonlyMap<string, Ingredient>;
}

export function makeCatalog(list: readonly Ingredient[]): Catalog {
  return { list, byId: new Map(list.map((i) => [i.id, i])) };
}

export const DEFAULT_CATALOG: Catalog = makeCatalog(CATALOG);

/** "Lime juice" -> "lime-juice". Ingredient ids look like this. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Find a typed-in name among the ingredients we know (the default bar, then
 * KNOWN_EXTRAS), by id, name or alias. Anything after " - " is a note and is
 * ignored: "Agave syrup - diluted if in a pump" is agave syrup.
 */
export function findKnownIngredient(name: string): Ingredient | undefined {
  const slug = slugify(name.split(" - ")[0]!);
  const known = [...CATALOG, ...KNOWN_EXTRAS];
  const id = ALIASES[slug] ?? slug;
  return known.find((i) => i.id === id || slugify(i.name) === slug);
}

/**
 * What one container of an ingredient usually holds, in ml, so stock can be
 * entered as "2 bottles". Garnishes are counted one by one (1). Override per
 * ingredient with `container` when a bottle isn't the usual size.
 */
export function defaultContainer(ing: Pick<Ingredient, "type" | "unit" | "flavor">): number {
  if (ing.unit === "piece") return 1;
  if (ing.type === "base") return ing.flavor.includes("wine") || ing.flavor.includes("sparkling") ? 750 : 700;
  if (ing.type === "mixer") return 1000;
  switch (ing.unit) {
    case "pump":
      return 750;
    case "dash":
      return 200;
    case "drop":
      return 100;
    case "barspoon":
      return 250;
    default:
      return 1000;
  }
}
