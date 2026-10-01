import { findKnownIngredient, Ingredient, slugify } from "@sloptail/shared";
import { z } from "zod";
import type { LlmClient, Message } from "./client.ts";
import { extractJson } from "./parse.ts";

const Described = z.object({ ingredients: z.array(Ingredient.omit({ stock: true })) });
const DESCRIBED_JSON_SCHEMA = z.toJSONSchema(Described) as Record<string, unknown>;

export interface DescribeResult {
  ingredients: Ingredient[];
  /** Names the model didn't return anything usable for. */
  failed: string[];
}

/**
 * Turn names typed on the admin screen into catalog entries. Anything in the
 * default list is copied from there; the rest are filled in by the model
 * (type, unit, ABV, flavours, sugar/acid, a sensible max). One round-trip, no
 * repairs: the admin reviews every row before saving.
 */
export async function describeIngredients(names: readonly string[], client: LlmClient): Promise<DescribeResult> {
  const known: Ingredient[] = [];
  const unknown: string[] = [];
  for (const name of names) {
    const hit = findKnownIngredient(name);
    if (hit) known.push(hit);
    else unknown.push(name);
  }
  if (!unknown.length) return { ingredients: known, failed: [] };

  let described: Record<string, unknown>[] = [];
  try {
    const completion = await client.complete({
      messages: describeMessages(unknown),
      jsonSchema: { name: "ingredients", schema: DESCRIBED_JSON_SCHEMA },
      temperature: 0.2,
    });
    const json = extractJson(completion.text) as { ingredients?: unknown };
    if (Array.isArray(json?.ingredients)) described = json.ingredients.filter((x) => x && typeof x === "object");
  } catch {
    /* model down or unparseable: everything lands in `failed` below, for the admin to fill in */
  }
  const failed: string[] = [];
  const filled: Ingredient[] = [];
  for (const name of unknown) {
    const slug = slugify(name);
    const raw = described.find((i) => slugify(String(i.name ?? "")) === slug || i.id === slug);
    // The typed name wins over whatever the model called it. One bad entry doesn't sink the rest.
    const parsed = raw ? Ingredient.safeParse({ ...raw, id: slug, name: name.trim(), stock: undefined }) : null;
    if (parsed?.success) filled.push(parsed.data);
    else failed.push(name);
  }
  return { ingredients: [...known, ...filled], failed };
}

export function describeMessages(names: readonly string[]): Message[] {
  return [
    {
      role: "system",
      content: `You set up the ingredient list for a pop-up cocktail bar. Drinks are built in the glass over ice, no shaker. For each ingredient name you're given, return a catalog entry.

Fields:
- id: the name in lowercase with dashes ("Lime juice" -> "lime-juice").
- name: the name exactly as given.
- type: "base" (spirits, fortified wine, liqueurs), "mixer" (sodas, juices, teas used to lengthen), "flavoring" (syrups, citrus, bitters, tinctures, acids, anything used in small amounts), or "garnish" (herbs, peels, spices placed in the glass).
- unit: "part" (1 part = 30ml) for anything poured with a jigger; "barspoon" for thick things used by the spoon; "dash" for bitters; "drop" for tinctures, extracts and solutions; "piece" for garnishes.
- flavor: 2-4 short tags.
- alcoholic: true if it contains any alcohol (bitters and tinctures do). abv: percentage, only if alcoholic.
- max: a sensible per-drink cap in that unit for anything potent (syrups ~0.75 part, citrus ~1 part, bitters ~4 dashes, tinctures and extracts 2-4 drops, garnishes 1-2). Omit for spirits and mixers.
- sugar and acid: rough grams per 100ml, only if meaningfully above zero (e.g. cola sugar 10.6 acid 0.1; lime juice sugar 1.5 acid 6; 1:1 simple syrup sugar 60).
- notes: optional, a short bar-side tip only if it matters (e.g. "overpowering, 1 drop is plenty").

Respond with a single JSON object {"ingredients": [...]} and nothing else.`,
    },
    { role: "user", content: names.map((n) => `- ${n}`).join("\n") },
  ];
}
