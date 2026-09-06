import type { Ingredient } from "./types.js";

/**
 * The starter bar. Edit freely: this is the single source of truth for what
 * the model is allowed to use and what the bar screen shows.
 */
export const CATALOG: Ingredient[] = [
  // --- Bases ------------------------------------------------------------
  { id: "vodka", name: "Vodka", type: "base", flavor: ["neutral", "clean"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "gin", name: "Gin", type: "base", flavor: ["juniper", "botanical", "dry"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "white-rum", name: "White rum", type: "base", flavor: ["sweet", "grassy", "light"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "dark-rum", name: "Dark rum", type: "base", flavor: ["molasses", "caramel", "rich"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "tequila", name: "Tequila blanco", type: "base", flavor: ["agave", "peppery", "earthy"], alcoholic: true, abv: 40, unit: "ml" },
  { id: "bourbon", name: "Bourbon", type: "base", flavor: ["vanilla", "oak", "sweet", "warm"], alcoholic: true, abv: 45, unit: "ml" },
  { id: "aperol", name: "Aperol", type: "base", flavor: ["bitter", "orange", "sweet"], alcoholic: true, abv: 11, unit: "ml" },
  { id: "campari", name: "Campari", type: "base", flavor: ["bitter", "herbal", "orange"], alcoholic: true, abv: 25, unit: "ml" },
  { id: "sweet-vermouth", name: "Sweet vermouth", type: "base", flavor: ["herbal", "sweet", "wine"], alcoholic: true, abv: 16, unit: "ml" },
  { id: "dry-vermouth", name: "Dry vermouth", type: "base", flavor: ["herbal", "dry", "wine"], alcoholic: true, abv: 16, unit: "ml" },
  { id: "triple-sec", name: "Triple sec", type: "base", flavor: ["orange", "sweet"], alcoholic: true, abv: 30, unit: "ml" },
  { id: "prosecco", name: "Prosecco", type: "base", flavor: ["sparkling", "dry", "apple"], alcoholic: true, abv: 11, unit: "ml", notes: "Pour last; keep cold" },

  // --- Mixers ------------------------------------------------------------
  { id: "soda", name: "Soda water", type: "mixer", flavor: ["neutral", "sparkling"], alcoholic: false, unit: "ml" },
  { id: "tonic", name: "Tonic water", type: "mixer", flavor: ["bitter", "sparkling", "quinine"], alcoholic: false, unit: "ml" },
  { id: "ginger-beer", name: "Ginger beer", type: "mixer", flavor: ["spicy", "ginger", "sparkling", "sweet"], alcoholic: false, unit: "ml" },
  { id: "ginger-ale", name: "Ginger ale", type: "mixer", flavor: ["ginger", "sparkling", "mild"], alcoholic: false, unit: "ml" },
  { id: "cola", name: "Cola", type: "mixer", flavor: ["sweet", "caramel", "sparkling"], alcoholic: false, unit: "ml" },
  { id: "lemonade", name: "Lemonade (cloudy)", type: "mixer", flavor: ["citrus", "sweet", "sour"], alcoholic: false, unit: "ml" },
  { id: "orange-juice", name: "Orange juice", type: "mixer", flavor: ["citrus", "sweet", "fruity"], alcoholic: false, unit: "ml" },
  { id: "cranberry-juice", name: "Cranberry juice", type: "mixer", flavor: ["tart", "fruity", "red"], alcoholic: false, unit: "ml" },
  { id: "pineapple-juice", name: "Pineapple juice", type: "mixer", flavor: ["tropical", "sweet", "fruity"], alcoholic: false, unit: "ml" },
  { id: "apple-juice", name: "Apple juice", type: "mixer", flavor: ["sweet", "fruity", "mild"], alcoholic: false, unit: "ml" },
  { id: "cold-brew", name: "Cold brew coffee", type: "mixer", flavor: ["coffee", "bitter", "roasted"], alcoholic: false, unit: "ml" },
  { id: "coconut-water", name: "Coconut water", type: "mixer", flavor: ["tropical", "light", "nutty"], alcoholic: false, unit: "ml" },

  // --- Flavorings --------------------------------------------------------
  { id: "lime-juice", name: "Lime juice", type: "flavoring", flavor: ["sour", "citrus"], alcoholic: false, unit: "ml" },
  { id: "lemon-juice", name: "Lemon juice", type: "flavoring", flavor: ["sour", "citrus"], alcoholic: false, unit: "ml" },
  { id: "simple-syrup", name: "Simple syrup", type: "flavoring", flavor: ["sweet"], alcoholic: false, unit: "ml" },
  { id: "honey-syrup", name: "Honey syrup", type: "flavoring", flavor: ["sweet", "floral", "honey"], alcoholic: false, unit: "ml" },
  { id: "grenadine", name: "Grenadine", type: "flavoring", flavor: ["sweet", "pomegranate", "red"], alcoholic: false, unit: "ml" },
  { id: "elderflower-cordial", name: "Elderflower cordial", type: "flavoring", flavor: ["floral", "sweet"], alcoholic: false, unit: "ml" },
  { id: "passionfruit-syrup", name: "Passionfruit syrup", type: "flavoring", flavor: ["tropical", "tart", "sweet"], alcoholic: false, unit: "ml" },
  { id: "angostura", name: "Angostura bitters", type: "flavoring", flavor: ["bitter", "spice", "clove"], alcoholic: true, abv: 45, unit: "dash" },
  { id: "orange-bitters", name: "Orange bitters", type: "flavoring", flavor: ["bitter", "orange"], alcoholic: true, abv: 40, unit: "dash" },
  { id: "chilli-tincture", name: "Chilli tincture", type: "flavoring", flavor: ["hot", "spicy"], alcoholic: true, abv: 40, unit: "drop", notes: "Very hot. 2 drops max." },
  { id: "salt-solution", name: "Saline solution", type: "flavoring", flavor: ["salty", "savoury"], alcoholic: false, unit: "drop" },
  { id: "vanilla-syrup", name: "Vanilla syrup", type: "flavoring", flavor: ["sweet", "vanilla"], alcoholic: false, unit: "pump" },

  // --- Garnishes ---------------------------------------------------------
  { id: "lime-wedge", name: "Lime wedge", type: "garnish", flavor: ["citrus"], alcoholic: false, unit: "piece" },
  { id: "lemon-twist", name: "Lemon twist", type: "garnish", flavor: ["citrus", "aromatic"], alcoholic: false, unit: "piece" },
  { id: "orange-slice", name: "Orange slice", type: "garnish", flavor: ["citrus"], alcoholic: false, unit: "piece" },
  { id: "mint-sprig", name: "Mint sprig", type: "garnish", flavor: ["herbal", "fresh"], alcoholic: false, unit: "piece" },
  { id: "cucumber-ribbon", name: "Cucumber ribbon", type: "garnish", flavor: ["fresh", "green"], alcoholic: false, unit: "piece" },
  { id: "cherry", name: "Cocktail cherry", type: "garnish", flavor: ["sweet", "red"], alcoholic: false, unit: "piece" },
  { id: "rosemary-sprig", name: "Rosemary sprig", type: "garnish", flavor: ["herbal", "piney"], alcoholic: false, unit: "piece" },
  { id: "chilli-slice", name: "Chilli slice", type: "garnish", flavor: ["hot"], alcoholic: false, unit: "piece" },
];

export const CATALOG_BY_ID: ReadonlyMap<string, Ingredient> = new Map(CATALOG.map((i) => [i.id, i]));

export function getIngredient(id: string): Ingredient | undefined {
  return CATALOG_BY_ID.get(id);
}
