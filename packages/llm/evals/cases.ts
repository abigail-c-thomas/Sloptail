import type { UserRequest } from "@sloptail/shared";

/**
 * Eval cases: representative guest requests. Add to this whenever a real
 * request produces something bad; the runner reports per-case validity.
 */
export interface EvalCase {
  id: string;
  request: UserRequest;
  /** Free-form expectations checked by the runner's heuristics. */
  expect?: {
    /** Ingredient ids that must appear. */
    includes?: string[];
    /** Ingredient ids that must not appear. */
    excludes?: string[];
    /** Regex the name or description should match. */
    mentions?: string;
  };
  /**
   * The same guest orders again with the first drink in their history. The
   * runner checks the second drink is clearly different, or (sameAgain) that
   * it's the same drink.
   */
  then?: { prompt: string; sameAgain?: boolean };
}

export const CASES: EvalCase[] = [
  {
    id: "classic-dark-and-stormy",
    request: { strength: "full", adventurousness: 1, prompt: "dark and stormy" },
    expect: { includes: ["rum", "ginger-beer"] },
  },
  {
    id: "safe-mocktail",
    request: { strength: "zero", adventurousness: 1, prompt: "something refreshing, not too sweet" },
    expect: { excludes: ["rum", "vodka", "whiskey", "mezcal", "angostura"] },
  },
  {
    id: "trace-bitters-ok",
    request: { strength: "trace", adventurousness: 2, prompt: "grown-up, dry, not a juice" },
  },
  {
    id: "half-citrus",
    request: { strength: "half", adventurousness: 2, prompt: "citrusy and light" },
  },
  {
    id: "wild-smoke",
    request: { strength: "full", adventurousness: 3, prompt: "I like smoky things and I like tea" },
    expect: { includes: ["mezcal"] },
  },
  {
    id: "wild-savoury",
    request: { strength: "full", adventurousness: 3, prompt: "savoury, weird, a bit spicy" },
  },
  {
    id: "empty-prompt-creative",
    request: { strength: "full", adventurousness: 2, prompt: "" },
  },
  {
    id: "hates-whiskey",
    request: { strength: "full", adventurousness: 2, prompt: "anything but whiskey. hate whiskey." },
    expect: { excludes: ["whiskey"] },
  },
  {
    id: "sweet-tooth-mocktail",
    request: { strength: "zero", adventurousness: 3, prompt: "I want dessert in a glass" },
    expect: { excludes: ["rum", "vodka", "whiskey", "mezcal", "angostura", "szechuan-tincture", "celery-tincture"] },
  },
  {
    id: "long-rambling",
    request: {
      strength: "half",
      adventurousness: 2,
      prompt:
        "ok so it's been a long week, i want something that feels like a holiday but i've got a demo after this so nothing too heavy, maybe tropical? but not sickly",
    },
  },

  // Strong flavourings: vegemite only at 3; peppercorn and celery only a touch at 2.
  {
    id: "savoury-classic",
    request: { strength: "full", adventurousness: 1, prompt: "something savoury" },
  },
  {
    id: "umami-creative",
    request: { strength: "full", adventurousness: 2, prompt: "salty, umami, a bit weird" },
  },
  {
    id: "umami-wild",
    request: { strength: "half", adventurousness: 3, prompt: "salty, umami, as weird as you dare" },
  },
  {
    id: "spicy-creative-mocktail",
    request: { strength: "zero", adventurousness: 2, prompt: "something with a tingle", spice: "high" },
  },

  // Flavour dials, mostly on mocktails where the bar has fewer ways to get there.
  {
    id: "dial-dry-sharp-mocktail",
    request: { strength: "zero", adventurousness: 2, prompt: "", sweetness: "low", acidity: "high" },
  },
  {
    id: "dial-sweet-soft-mocktail",
    request: { strength: "zero", adventurousness: 1, prompt: "", sweetness: "high", acidity: "low" },
  },
  {
    id: "dial-medium-trace",
    request: { strength: "trace", adventurousness: 2, prompt: "", sweetness: "medium", acidity: "medium" },
  },
  {
    id: "dial-dry-flat-full",
    request: { strength: "full", adventurousness: 2, prompt: "", sweetness: "low", acidity: "low" },
  },

  // Second drinks.
  {
    id: "second-different",
    request: { strength: "full", adventurousness: 2, prompt: "something fresh" },
    then: { prompt: "" },
  },
  {
    id: "second-different-mocktail",
    request: { strength: "zero", adventurousness: 2, prompt: "fruity" },
    then: { prompt: "another one please" },
  },
  {
    id: "second-same-again",
    request: { strength: "full", adventurousness: 1, prompt: "gin and tonic-ish" },
    then: { prompt: "same again please, that was great", sameAgain: true },
  },
];
