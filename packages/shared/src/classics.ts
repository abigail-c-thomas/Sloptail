import type { Proposal, Strength } from "./types.ts";
import { DEFAULT_CATALOG, type Catalog } from "./catalog.ts";

export interface Classic {
  id: string;
  proposal: Proposal;
  /** Which strengths this is suitable for. Half-strength halves the base spirit. */
  strengths: Strength[];
}

/**
 * Menu for "not at all adventurous" guests and a fallback when the model is
 * down. Deliberately boring: the standard drink, poured the way any bar would,
 * no twists and no fancy garnish. Everything is built in the glass from
 * CATALOG or KNOWN_EXTRAS; classicsFor drops any that need something the
 * current bar doesn't stock.
 */
export const CLASSICS: Classic[] = [
  // --- With alcohol ------------------------------------------------------
  {
    id: "dark-and-stormy",
    strengths: ["half", "full"],
    proposal: {
      name: "Dark & Stormy",
      description: "Rum topped with ginger beer and a squeeze of lime, with a sprig of mint.",
      glass: "highball",
      recipe: [
        { ingredient: "rum", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "rum-and-coke",
    strengths: ["half", "full"],
    proposal: {
      name: "Rum & Coke",
      description: "Rum and Coke with a squeeze of lime.",
      glass: "highball",
      recipe: [
        { ingredient: "rum", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "cola", amount: "fill" },
      ],
    },
  },
  {
    id: "whiskey-ginger",
    strengths: ["half", "full"],
    proposal: {
      name: "Whiskey & Ginger",
      description: "Whiskey topped with ginger beer.",
      glass: "highball",
      recipe: [
        { ingredient: "whiskey", amount: 1.5 },
        { ingredient: "ginger-beer", amount: "fill" },
      ],
    },
  },
  {
    id: "whiskey-and-coke",
    strengths: ["half", "full"],
    proposal: {
      name: "Whiskey & Coke",
      description: "Whiskey and Coke.",
      glass: "highball",
      recipe: [
        { ingredient: "whiskey", amount: 1.5 },
        { ingredient: "cola", amount: "fill" },
      ],
    },
  },
  {
    id: "vodka-lime-soda",
    strengths: ["half", "full"],
    proposal: {
      name: "Vodka Soda",
      description: "Vodka and soda with a squeeze of lime and a sprig of mint.",
      glass: "highball",
      recipe: [
        { ingredient: "vodka", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "soda", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "vodka-tonic",
    strengths: ["half", "full"],
    proposal: {
      name: "Vodka Tonic",
      description: "Vodka and tonic with a squeeze of lime.",
      glass: "highball",
      recipe: [
        { ingredient: "vodka", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "tonic", amount: "fill" },
      ],
    },
  },
  {
    id: "mezcal-tonic",
    strengths: ["half", "full"],
    proposal: {
      name: "Mezcal & Tonic",
      description: "Mezcal and tonic with a twist of citrus peel. Smoky.",
      glass: "highball",
      recipe: [
        { ingredient: "mezcal", amount: 1.5 },
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  },
  {
    id: "vermouth-tonic",
    strengths: ["half", "full"],
    proposal: {
      name: "Vermouth & Tonic",
      description: "Dry vermouth and tonic with a twist of citrus peel. Light and dry.",
      glass: "highball",
      recipe: [
        { ingredient: "dry-vermouth", amount: 2.5 },
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  },
  {
    id: "kalimotxo",
    strengths: ["half", "full"],
    proposal: {
      name: "Kalimotxo",
      description: "Red wine and Coke, half and half. The Basque classic.",
      glass: "highball",
      recipe: [
        { ingredient: "red-wine", amount: 4 },
        { ingredient: "cola", amount: "fill" },
      ],
    },
  },

  // --- Without -----------------------------------------------------------
  {
    id: "na-whiskey-ginger",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Zero Whiskey & Ginger",
      description: "Non-alcoholic whiskey topped with ginger beer.",
      glass: "highball",
      recipe: [
        { ingredient: "na-whiskey", amount: 1.5 },
        { ingredient: "ginger-beer", amount: "fill" },
      ],
    },
  },
  {
    id: "na-vodka-soda",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Zero Vodka Soda",
      description: "Non-alcoholic vodka and soda with a squeeze of lime and a sprig of mint.",
      glass: "highball",
      recipe: [
        { ingredient: "na-vodka", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "soda", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "na-ranch-water",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Zero Ranch Water",
      description: "Non-alcoholic tequila, lime and soda.",
      glass: "highball",
      recipe: [
        { ingredient: "na-tequila", amount: 1.5 },
        { ingredient: "lime-juice", amount: 0.5 },
        { ingredient: "soda", amount: "fill" },
      ],
    },
  },
  {
    id: "lime-soda-bitters",
    strengths: ["trace"],
    proposal: {
      name: "Lime, Soda & Bitters",
      description: "Soda, lime, a little sweetness and a few dashes of bitters.",
      glass: "highball",
      recipe: [
        { ingredient: "angostura", amount: 3 },
        { ingredient: "agave-syrup", amount: 1 },
        { ingredient: "lime-juice", amount: 0.5 },
        { ingredient: "soda", amount: "fill" },
      ],
    },
  },
  {
    id: "ginger-lime",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Ginger Beer & Lime",
      description: "Ginger beer with a squeeze of lime.",
      glass: "highball",
      recipe: [
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "ginger-beer", amount: "fill" },
      ],
    },
  },
  {
    id: "pineapple-ginger-fizz",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Pineapple & Ginger Beer",
      description: "Pineapple juice topped with ginger beer, with a sprig of mint.",
      glass: "highball",
      recipe: [
        { ingredient: "pineapple-juice", amount: 2 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "iced-tea",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Iced Tea",
      description: "Cold black tea with honey and lime.",
      glass: "highball",
      recipe: [
        { ingredient: "black-tea", amount: 4 },
        { ingredient: "honey-syrup", amount: 1 },
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "soda", amount: "fill" },
      ],
    },
  },
  {
    id: "coke-and-lime",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Coke & Lime",
      description: "Coke with a squeeze of lime.",
      glass: "highball",
      recipe: [
        { ingredient: "lime-juice", amount: 0.25 },
        { ingredient: "cola", amount: "fill" },
      ],
    },
  },
];

/**
 * Classics suitable for a strength that this bar can make. A missing garnish
 * is just left off; a missing liquid rules the drink out. Half-strength halves
 * any base spirit.
 */
export function classicsFor(strength: Strength, catalog: Catalog = DEFAULT_CATALOG): Classic[] {
  const has = (id: string) => catalog.byId.has(id);
  const isGarnish = (id: string) => DEFAULT_CATALOG.byId.get(id)?.type === "garnish";
  return CLASSICS.filter((c) => c.strengths.includes(strength)).flatMap((c) => {
    const kept = c.proposal.recipe.filter((r) => has(r.ingredient) || !isGarnish(r.ingredient));
    if (!kept.every((r) => has(r.ingredient))) return [];
    const recipe =
      strength === "half"
        ? kept.map((r) => (catalog.byId.get(r.ingredient)?.type === "base" && r.amount !== "fill" ? { ...r, amount: r.amount / 2 } : r))
        : kept;
    return [{ ...c, proposal: { ...c.proposal, recipe } }];
  });
}
