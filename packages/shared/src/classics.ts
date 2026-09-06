import type { Proposal, Strength } from "./types.ts";

export interface Classic {
  id: string;
  proposal: Proposal;
  /** Which strengths this is suitable for as-is. */
  strengths: Strength[];
}

/**
 * Fallback menu for "not at all adventurous" users, and for the bar when the
 * model is unreachable. Everything here must be makeable from CATALOG.
 */
export const CLASSICS: Classic[] = [
  {
    id: "gin-tonic",
    strengths: ["half", "full"],
    proposal: {
      name: "Gin & Tonic",
      description: "The one that needs no introduction. Crisp, bitter, cold.",
      method: "build",
      glass: "highball",
      recipe: [
        { ingredient: "gin", amount: 50 },
        { ingredient: "tonic", amount: "fill" },
        { ingredient: "lime-wedge", amount: 1 },
      ],
    },
  },
  {
    id: "aperol-spritz",
    strengths: ["half", "full"],
    proposal: {
      name: "Aperol Spritz",
      description: "Bittersweet orange, bubbles, and a strong sense of being on holiday.",
      method: "build",
      glass: "wine",
      recipe: [
        { ingredient: "prosecco", amount: 90 },
        { ingredient: "aperol", amount: 60 },
        { ingredient: "soda", amount: 30 },
        { ingredient: "orange-slice", amount: 1 },
      ],
    },
  },
  {
    id: "moscow-mule",
    strengths: ["half", "full"],
    proposal: {
      name: "Moscow Mule",
      description: "Vodka, lime and a big spicy hit of ginger beer.",
      method: "build",
      glass: "highball",
      recipe: [
        { ingredient: "vodka", amount: 50 },
        { ingredient: "lime-juice", amount: 15 },
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "lime-wedge", amount: 1 },
      ],
    },
  },
  {
    id: "margarita",
    strengths: ["half", "full"],
    proposal: {
      name: "Margarita",
      description: "Tequila, lime and orange liqueur. Sharp and sunny.",
      method: "shake",
      glass: "rocks",
      recipe: [
        { ingredient: "tequila", amount: 50 },
        { ingredient: "triple-sec", amount: 25 },
        { ingredient: "lime-juice", amount: 25 },
        { ingredient: "lime-wedge", amount: 1 },
      ],
    },
  },
  {
    id: "negroni",
    strengths: ["full"],
    proposal: {
      name: "Negroni",
      description: "Equal parts gin, Campari and sweet vermouth. Bitter, boozy, red.",
      method: "stir",
      glass: "rocks",
      recipe: [
        { ingredient: "gin", amount: 30 },
        { ingredient: "campari", amount: 30 },
        { ingredient: "sweet-vermouth", amount: 30 },
        { ingredient: "orange-slice", amount: 1 },
      ],
    },
  },
  {
    id: "whiskey-sour",
    strengths: ["half", "full"],
    proposal: {
      name: "Whiskey Sour",
      description: "Bourbon, lemon and sugar, shaken hard.",
      method: "shake",
      glass: "rocks",
      recipe: [
        { ingredient: "bourbon", amount: 50 },
        { ingredient: "lemon-juice", amount: 25 },
        { ingredient: "simple-syrup", amount: 15 },
        { ingredient: "angostura", amount: 2 },
        { ingredient: "cherry", amount: 1 },
      ],
    },
  },
  {
    id: "nojito",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Nojito",
      description: "Mint, lime, sugar and soda. All the freshness, none of the rum.",
      method: "build",
      glass: "highball",
      recipe: [
        { ingredient: "mint-sprig", amount: 2 },
        { ingredient: "lime-juice", amount: 25 },
        { ingredient: "simple-syrup", amount: 15 },
        { ingredient: "soda", amount: "fill" },
      ],
    },
  },
  {
    id: "elderflower-collins",
    strengths: ["zero", "trace"],
    proposal: {
      name: "Elderflower Collins",
      description: "Floral, lemony and long. Tastes like a garden party.",
      method: "build",
      glass: "highball",
      recipe: [
        { ingredient: "elderflower-cordial", amount: 25 },
        { ingredient: "lemon-juice", amount: 20 },
        { ingredient: "soda", amount: "fill" },
        { ingredient: "cucumber-ribbon", amount: 1 },
      ],
    },
  },
  {
    id: "ginger-bitters-fizz",
    strengths: ["trace"],
    proposal: {
      name: "Ginger Bitters Fizz",
      description: "Ginger beer, lime and a couple of dashes of bitters. Grown-up and dry.",
      method: "build",
      glass: "highball",
      recipe: [
        { ingredient: "ginger-beer", amount: "fill" },
        { ingredient: "lime-juice", amount: 15 },
        { ingredient: "angostura", amount: 3 },
        { ingredient: "lime-wedge", amount: 1 },
      ],
    },
  },
  {
    id: "sunrise",
    strengths: ["zero"],
    proposal: {
      name: "Sunrise",
      description: "Orange juice with a grenadine sink. Looks great, tastes like being eight.",
      method: "build",
      glass: "highball",
      recipe: [
        { ingredient: "orange-juice", amount: "fill" },
        { ingredient: "grenadine", amount: 10 },
        { ingredient: "cherry", amount: 1 },
      ],
    },
  },
];

export function classicsFor(strength: Strength): Classic[] {
  return CLASSICS.filter((c) => c.strengths.includes(strength));
}
