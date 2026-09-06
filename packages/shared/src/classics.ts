import type { Proposal, Strength } from "./types.ts";
import { CATALOG_BY_ID } from "./catalog.ts";

export interface Classic {
  id: string;
  proposal: Proposal;
  /** Which strengths this is suitable for. Half-strength halves the base spirit. */
  strengths: Strength[];
}

/**
 * Menu for "not at all adventurous" guests and a fallback when the model is
 * down. Everything here is built in the glass from CATALOG.
 */
export const CLASSICS: Classic[] = [
  {
    id: "dark-and-stormy",
    strengths: ["half", "full"],
    proposal: {
      name: "Dark & Stormy",
      description: "Rum, lime and a lot of ginger beer. Spicy, cold, reliable.",
      glass: "highball",
      recipe: [
        { ingredient: "rum", amount: 50 },
        { ingredient: "lime-juice", amount: 15 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "cuba-libre",
    strengths: ["half", "full"],
    proposal: {
      name: "Cuba Libre",
      description: "Rum and Coke with enough lime to make it a cocktail.",
      glass: "highball",
      recipe: [
        { ingredient: "rum", amount: 50 },
        { ingredient: "lime-juice", amount: 10 },
        { ingredient: "cola", amount: "fill" },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  },
  {
    id: "whiskey-ginger",
    strengths: ["half", "full"],
    proposal: {
      name: "Whiskey Ginger",
      description: "Whiskey, ginger beer, a dash of bitters. The grown-up highball.",
      glass: "highball",
      recipe: [
        { ingredient: "whiskey", amount: 50 },
        { ingredient: "angostura", amount: 2 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  },
  {
    id: "mezcal-tonic",
    strengths: ["half", "full"],
    proposal: {
      name: "Mezcal & Tonic",
      description: "Smoke and quinine. Like a gin and tonic that's been to a bonfire.",
      glass: "highball",
      recipe: [
        { ingredient: "mezcal", amount: 45 },
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "rosemary-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "vodka-lime-soda",
    strengths: ["half", "full"],
    proposal: {
      name: "Vodka Lime Soda",
      description: "Exactly what it says. Clean and cold.",
      glass: "highball",
      recipe: [
        { ingredient: "vodka", amount: 50 },
        { ingredient: "lime-juice", amount: 15 },
        { ingredient: "soda", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "gold-rush-highball",
    strengths: ["half", "full"],
    proposal: {
      name: "Gold Rush Highball",
      description: "Whiskey, honey and lime, lengthened with soda.",
      glass: "highball",
      recipe: [
        { ingredient: "whiskey", amount: 50 },
        { ingredient: "honey-syrup", amount: 15 },
        { ingredient: "lime-juice", amount: 20 },
        { ingredient: "soda", amount: "fill" },
      ],
    },
  },
  {
    id: "pineapple-ginger-fizz",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Pineapple Ginger Fizz",
      description: "Pineapple, lime and ginger beer. Tastes like a holiday you didn't book.",
      glass: "highball",
      recipe: [
        { ingredient: "pineapple-juice", amount: 60 },
        { ingredient: "lime-juice", amount: 10 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "mint-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "honey-iced-tea",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Honey Iced Tea",
      description: "Strong black tea, dark honey, lime, topped with soda. Dry and refreshing.",
      glass: "highball",
      recipe: [
        { ingredient: "black-tea", amount: 90 },
        { ingredient: "honey-syrup", amount: 10 },
        { ingredient: "lime-juice", amount: 10 },
        { ingredient: "soda", amount: "fill" },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  },
  {
    id: "chamomile-tonic",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Chamomile Tonic",
      description: "Floral tea and bitter tonic. Calming and bracing at the same time.",
      glass: "highball",
      recipe: [
        { ingredient: "herbal-tea", amount: 60 },
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "rosemary-sprig", amount: 1 },
      ],
    },
  },
  {
    id: "bitter-ginger",
    strengths: ["trace"],
    proposal: {
      name: "Bitter Ginger",
      description: "Ginger beer, lime and a few dashes of bitters. Grown-up and dry.",
      glass: "highball",
      recipe: [
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "lime-juice", amount: 15 },
        { ingredient: "angostura", amount: 3 },
        { ingredient: "citrus-peel", amount: 1 },
      ],
    },
  },
];

/** Classics suitable for a strength. Half-strength halves any base spirit. */
export function classicsFor(strength: Strength): Classic[] {
  return CLASSICS.filter((c) => c.strengths.includes(strength)).map((c) =>
    strength === "half"
      ? {
          ...c,
          proposal: {
            ...c.proposal,
            recipe: c.proposal.recipe.map((r) =>
              CATALOG_BY_ID.get(r.ingredient)?.type === "base" && r.amount !== "fill" ? { ...r, amount: r.amount / 2 } : r,
            ),
          },
        }
      : c,
  );
}
