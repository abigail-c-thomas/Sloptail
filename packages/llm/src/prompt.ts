import {
  ALCOHOL_BUDGET,
  CATALOG,
  type Ingredient,
  type Proposal,
  type Strength,
  type UserRequest,
} from "@sloptail/shared";
import type { Message } from "./client.js";
import { PROPOSAL_JSON_SCHEMA } from "./parse.js";

export interface PromptContext {
  userName: string;
  request: UserRequest;
  unavailable: ReadonlySet<string>;
  /** Names of drinks already on the board tonight, so the model avoids repeats. */
  recentNames?: readonly string[] | undefined;
}

const STRENGTH_TEXT: Record<Strength, string> = {
  zero: "MOCKTAIL, strictly zero alcohol. No spirits, no liqueurs, no bitters, nothing alcoholic at all.",
  trace: "MOCKTAIL. No spirits or liqueurs. A dash or two of bitters is acceptable, nothing else alcoholic.",
  half: "Half-strength cocktail: about half the usual spirit measure (roughly 25ml of a 40% spirit, or equivalent).",
  full: "Full-strength cocktail: a normal serve (roughly 50ml of a 40% spirit, or equivalent).",
};

const ADVENTURE_TEXT: Record<1 | 2 | 3, string> = {
  1: "Play it safe. Stick to a well-known classic, or a very close riff on one.",
  2: "Get creative. A recognisable structure with an unexpected twist: an unusual pairing, a surprising garnish, a flavour from an unexpected place.",
  3: "Go wild. Something they have never had before. Weird pairings that still taste good. Coffee and tonic. Chilli and pineapple. Saline in a sour. Take a real swing, but it must still be drinkable.",
};

function ingredientLine(i: Ingredient): string {
  const alc = i.alcoholic ? ` alcoholic${i.abv ? ` ${i.abv}%` : ""}` : "";
  const notes = i.notes ? ` (${i.notes})` : "";
  return `- ${i.id}: ${i.name} [${i.type}, unit=${i.unit}${alc}] flavours: ${i.flavor.join(", ")}${notes}`;
}

export function systemPrompt(ctx: PromptContext): string {
  const available = CATALOG.filter((i) => !ctx.unavailable.has(i.id));
  const budget = ALCOHOL_BUDGET[ctx.request.strength];
  return `You are the bartender at a tech company's "AI happy hour". Guests order from their phones and you invent a drink for each of them. Drinks must be genuinely good, interesting, and quick to make behind a small pop-up bar.

## Available ingredients (use ONLY these ids)
${available.map(ingredientLine).join("\n")}

## Rules
- Use only ingredient ids from the list above. Anything else will be rejected.
- Amounts are in each ingredient's unit (ml, dash, drop, pump, piece). Use "fill" for topping up with a mixer.
- List ingredients in the order the bartender should add them. Sparkling things go last.
- 3 to 6 ingredients. At most 2 bases. Keep it makeable in under 90 seconds.
- Total liquid before any "fill" should be 60-120ml for a highball, 60-100ml for a rocks/coupe.
- Strength: ${STRENGTH_TEXT[ctx.request.strength]} Target ${budget.min}-${budget.max}ml of pure alcohol.
- Adventurousness: ${ADVENTURE_TEXT[ctx.request.adventurousness]}
- Take the guest's request seriously and reflect it in the drink. If they name a specific classic, make that.
- Name: short, memorable, dry humour welcome. No puns on the guest's name unless they invite it.
- Description: one or two sentences, second person, tells them what it will taste like. No marketing fluff.${
    ctx.recentNames?.length
      ? `\n- Avoid reusing these names already served tonight: ${ctx.recentNames.join(", ")}.`
      : ""
  }

## Output
Respond with a single JSON object and nothing else, matching this schema:
${JSON.stringify(PROPOSAL_JSON_SCHEMA)}`;
}

export function proposeMessages(ctx: PromptContext): Message[] {
  const r = ctx.request;
  const prompt = r.prompt.trim() || "(no specific request, surprise them)";
  return [
    { role: "system", content: systemPrompt(ctx) },
    {
      role: "user",
      content: `Guest: ${ctx.userName}\nStrength: ${r.strength}\nAdventurousness: ${r.adventurousness}/3\nWhat they said they feel like: ${prompt}`,
    },
  ];
}

export function editMessages(ctx: PromptContext, previous: Proposal, tweak: string): Message[] {
  return [
    ...proposeMessages(ctx),
    { role: "assistant", content: JSON.stringify(previous) },
    {
      role: "user",
      content: `The guest wants a change: "${tweak.trim()}"\nAdjust the drink accordingly. Keep what they didn't ask to change. Return the full JSON object again.`,
    },
  ];
}

/** Follow-up when the previous answer failed validation. */
export function repairMessages(prior: Message[], badResponse: string, problems: string[]): Message[] {
  return [
    ...prior,
    { role: "assistant", content: badResponse },
    {
      role: "user",
      content: `That recipe has problems:\n${problems.map((p) => `- ${p}`).join("\n")}\nFix them and return the full JSON object again.`,
    },
  ];
}
