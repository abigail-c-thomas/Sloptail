import {
  ACIDITY_BANDS,
  ALCOHOL_BUDGET,
  CATALOG_BY_ID,
  FILL_TO_ML,
  ML_PER_PART,
  offeredIngredients,
  SWEETNESS_BANDS,
  type Ingredient,
  type Level,
  type Proposal,
  type Strength,
  type UserRequest,
} from "@sloptail/shared";
import type { Message } from "./client.ts";
import { PROPOSAL_JSON_SCHEMA } from "./parse.ts";

export interface PromptContext {
  userName: string;
  request: UserRequest;
  unavailable: ReadonlySet<string>;
  /** Names of drinks already on the board tonight, so the model avoids repeats. */
  recentNames?: readonly string[] | undefined;
  /** This guest's earlier drinks (ordered or just shown), newest first, so the next one is different. */
  history?: readonly Proposal[] | undefined;
}

const STRENGTH_TEXT: Record<Strength, string> = {
  zero: "MOCKTAIL, zero alcohol. The list above already contains nothing alcoholic; use only what is listed.",
  trace: "MOCKTAIL. The list above has no spirits; the only alcoholic items are bitters and tinctures, which are fine in dashes and drops.",
  half: "Half-strength cocktail: about half the usual spirit measure (roughly 3/4 part of a 40% spirit, or equivalent).",
  full: "Full-strength cocktail: a normal serve (roughly 1.5 parts of a 40% spirit, or equivalent).",
};

const ADVENTURE_TEXT: Record<1 | 2 | 3, string> = {
  1: "Play it safe. Stick to a well-known classic, or a very close riff on one.",
  2: "Get creative. A recognisable structure with an unexpected twist: an unusual pairing, a surprising garnish, a flavour from an unexpected place.",
  3: "Go wild. Something they have never had before. Weird pairings that still taste good. Coffee and tonic. Chilli and pineapple. Saline in a sour. Take a real swing, but it must still be drinkable.",
};

function ingredientLine(i: Ingredient): string {
  const alc = i.alcoholic ? ` alcoholic${i.abv ? ` ${i.abv}%` : ""}` : "";
  const max = i.max ? ` max ${i.max}` : "";
  const sugar = i.sugar ? ` sugar ${i.sugar}` : "";
  const acid = i.acid ? ` acid ${i.acid}` : "";
  const notes = i.notes ? ` (${i.notes})` : "";
  return `- ${i.id}: ${i.name} [${i.type}, unit=${i.unit}${max}${alc}${sugar}${acid}] flavours: ${i.flavor.join(", ")}${notes}`;
}

const LEVEL_TEXT: Record<"sweetness" | "acidity", Record<Level, string>> = {
  sweetness: {
    low: `low: under ${SWEETNESS_BANDS.low}g sugar per 100ml`,
    medium: `medium: ${SWEETNESS_BANDS.low}-${SWEETNESS_BANDS.high}g sugar per 100ml`,
    high: `high: over ${SWEETNESS_BANDS.high}g sugar per 100ml`,
  },
  acidity: {
    low: `low: under ${ACIDITY_BANDS.low}g acid per 100ml`,
    medium: `medium: ${ACIDITY_BANDS.low}-${ACIDITY_BANDS.high}g acid per 100ml`,
    high: `high: over ${ACIDITY_BANDS.high}g acid per 100ml`,
  },
};

/** Familiar drinks to compare against, in g per 100ml. Rough, but in the right order. */
const REFERENCE_POINTS =
  "Sugar: dry white wine 0.2, prosecco 1, iced tea 7, tonic 8.5, orange juice 9, Coke 10.6. " +
  "Acid: Coke 0.1, tonic 0.3, apple juice 0.5, white wine 0.6, orange juice 0.8, lemonade 1.";

/** One line per earlier drink: name and what went in it, no amounts. */
function historyLine(p: Proposal): string {
  const parts = p.recipe.map((r) => CATALOG_BY_ID.get(r.ingredient)?.name ?? r.ingredient);
  return `- ${p.name}: ${parts.join(", ")}`;
}

export function systemPrompt(ctx: PromptContext): string {
  const available = offeredIngredients(ctx.request.strength, ctx.unavailable);
  const budget = ALCOHOL_BUDGET[ctx.request.strength];
  return `You are the bartender at a tech company's "AI happy hour". Guests order from their phones and you invent a drink for each of them. Drinks must be genuinely good, interesting, and quick to make behind a small pop-up bar with unusual flavourings (tinctures, teas, acids, smoke) and no shaker.

## Available ingredients (use ONLY these ids)
${available.map(ingredientLine).join("\n")}

## Rules
- Use only ingredient ids from the list above. Anything else will be rejected.
- Amounts are in each ingredient's unit (part, dash, drop, barspoon, piece). 1 part = 30ml, poured with a jigger, so parts go in quarter steps only: 0.25, 0.5, 0.75, 1, 1.25, 1.5, ... Use "fill" for topping up with a mixer.
- Every drink is built directly in the serving glass over ice. No shaking, no stirring in a separate vessel, no straining. Design for that: no egg white, no need to chill separately.
- List ingredients in the order the bartender should add them: spirits and flavourings first, then juices and teas, sparkling things last.
- 3 to 6 ingredients. At most 2 bases. Respect each ingredient's max. Keep it makeable in under 60 seconds.
- Total liquid before any "fill" should be 2-4 parts for a highball, 2-3 parts for a rocks glass. "fill" tops the glass up to about ${FILL_TO_ML.highball / ML_PER_PART} parts (highball) or ${FILL_TO_ML.rocks / ML_PER_PART} parts (rocks).
- The unusual flavourings (tinctures, liquid smoke, rose water, tannin, lactic acid) are the point at higher adventurousness, but one or two per drink, in small amounts. At adventurousness 1, use none of them.
- Strength: ${STRENGTH_TEXT[ctx.request.strength]} Target ${budget.min}-${budget.max}ml of pure alcohol.
- Adventurousness: ${ADVENTURE_TEXT[ctx.request.adventurousness]}
- Take the guest's request seriously and reflect it in the drink. If they name a specific classic, make that.
- Name: short, memorable, dry humour welcome. No puns on the guest's name unless they invite it.
- Balance: sugar and acid figures above are grams per 100ml of that ingredient. Work out roughly how sweet and sour the finished drink is (including the fill). Bands for the finished drink: sweetness ${Object.values(LEVEL_TEXT.sweetness).join("; ")}. Sourness ${Object.values(LEVEL_TEXT.acidity).join("; ")}.${
    ctx.request.sweetness ? `\n- The guest wants sweetness ${LEVEL_TEXT.sweetness[ctx.request.sweetness]}.` : ""
  }${ctx.request.acidity ? `\n- The guest wants sourness ${LEVEL_TEXT.acidity[ctx.request.acidity]}.` : ""}
- Description: one or two sentences, second person, tells them what it will taste like. Include a comparison to something everyday they already know for sweetness or sourness, e.g. "about as sweet as a white wine", "sharper than lemonade", "less sweet than a Coke". Reference points (g per 100ml): ${REFERENCE_POINTS} No marketing fluff.${
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
  const flavour = [
    r.sweetness ? `Sweetness: ${r.sweetness}` : "",
    r.acidity ? `Sourness: ${r.acidity}` : "",
  ].filter(Boolean);
  const history = ctx.history?.length
    ? `\n\nThey've already had or been offered:\n${ctx.history.map(historyLine).join("\n")}\nMake this one clearly different from those (a different base or mixer, and a different flavour direction), unless they ask for one of them again.`
    : "";
  return [
    { role: "system", content: systemPrompt(ctx) },
    {
      role: "user",
      content: `Guest: ${ctx.userName}\nStrength: ${r.strength}\nAdventurousness: ${r.adventurousness}/3\n${
        flavour.length ? `${flavour.join("\n")}\n` : ""
      }What they said they feel like: ${prompt}${history}`,
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
