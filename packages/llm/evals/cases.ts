import type { UserRequest } from "@sloptail/shared";

/**
 * Eval cases: representative guest requests. Add to this whenever a real
 * request produces something bad; the runner reports per-case validity.
 */
export interface EvalCase {
  id: string;
  userName: string;
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
}

export const CASES: EvalCase[] = [
  {
    id: "classic-negroni",
    userName: "Sam",
    request: { strength: "full", adventurousness: 1, prompt: "negroni" },
    expect: { includes: ["gin", "campari", "sweet-vermouth"] },
  },
  {
    id: "safe-mocktail",
    userName: "Priya",
    request: { strength: "zero", adventurousness: 1, prompt: "something refreshing, not too sweet" },
    expect: { excludes: ["gin", "vodka", "angostura"] },
  },
  {
    id: "trace-bitters-ok",
    userName: "Jo",
    request: { strength: "trace", adventurousness: 2, prompt: "grown-up, dry, not a juice" },
  },
  {
    id: "half-citrus",
    userName: "Lee",
    request: { strength: "half", adventurousness: 2, prompt: "citrusy and light" },
  },
  {
    id: "wild-coffee",
    userName: "Max",
    request: { strength: "full", adventurousness: 3, prompt: "I like coffee and I like tequila" },
    expect: { includes: ["cold-brew", "tequila"] },
  },
  {
    id: "wild-savoury",
    userName: "Ana",
    request: { strength: "full", adventurousness: 3, prompt: "savoury, weird, a bit spicy" },
  },
  {
    id: "empty-prompt-creative",
    userName: "Kit",
    request: { strength: "full", adventurousness: 2, prompt: "" },
  },
  {
    id: "hates-gin",
    userName: "Rob",
    request: { strength: "full", adventurousness: 2, prompt: "anything but gin. hate gin." },
    expect: { excludes: ["gin"] },
  },
  {
    id: "sweet-tooth-mocktail",
    userName: "Dee",
    request: { strength: "zero", adventurousness: 3, prompt: "I want dessert in a glass" },
    expect: { excludes: ["gin", "vodka", "bourbon", "angostura", "orange-bitters"] },
  },
  {
    id: "long-rambling",
    userName: "Ola",
    request: {
      strength: "half",
      adventurousness: 2,
      prompt:
        "ok so it's been a long week, i want something that feels like a holiday but i've got a demo after this so nothing too heavy, maybe tropical? but not sickly",
    },
  },
];
