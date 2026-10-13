/**
 * Eval runner: sends every case through `propose` against a real model and
 * reports validity, repair rate, latency, and the heuristic expectations.
 *
 *   OPENROUTER_API_KEY=... npm run eval -- [--model x] [--reps 2] [--only id] [--reasoning none|low|medium|high]
 *                                          [--catalog file.json] [--profile real]
 *
 * --catalog takes a JSON ingredient list, or a saved `GET /api/admin` response
 * (uses --profile, default "real"), so evals can run against what the bar will
 * actually stock. Without it, the built-in catalog.
 *
 * Cases run in order with the names served so far passed as recentNames, the
 * way the bar does, so name repetition shows up as it would on the night.
 *
 * Cost per proposal is computed from OpenRouter's public price list for the model.
 *
 * Results are written to evals/results/<timestamp>.json (gitignored) so runs
 * can be diffed by hand or fed to a judge later.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  ACIDITY_BANDS,
  DEFAULT_CATALOG,
  estimateBalance,
  formatAmount,
  levelOf,
  makeCatalog,
  SWEETNESS_BANDS,
  type Catalog,
  type Ingredient,
  type Level,
  type Proposal,
  type UserRequest,
} from "@sloptail/shared";
import { OpenRouterClient } from "../src/openrouter.ts";
import { propose, ProposeError, type Attempt } from "../src/propose.ts";
import { CASES, type EvalCase } from "./cases.ts";

const RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "&", "in", "on", "to", "for", "with", "at", "no", "not"]);

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not set");
  process.exit(1);
}
const model = args.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna";
const reps = Number(args.reps ?? 1);
const cases = args.only ? CASES.filter((c) => c.id === args.only) : CASES;
const catalog = args.catalog ? loadCatalog(args.catalog, args.profile ?? "real") : DEFAULT_CATALOG;

const reasoning = (args.reasoning ?? process.env.OPENROUTER_REASONING) as "none" | "low" | "medium" | "high" | undefined;
const client = new OpenRouterClient({ apiKey, model, appName: "sloptail-evals", reasoning });
const price = await fetchPrice(model);

interface CaseResult {
  id: string;
  rep: number;
  ok: boolean;
  ms: number;
  attempts: Attempt[];
  proposal?: Proposal;
  name?: string;
  recipe?: string;
  /** Finished drink, g per 100ml. */
  balance?: { sugar: number; acid: number };
  /** Per flavour dial asked for: how far off the drink landed (0 = in band). */
  dials?: { dial: "sweetness" | "acidity"; asked: Level; got: Level; off: number }[];
  failedExpectations: string[];
  error?: string;
}

const results: CaseResult[] = [];
const servedNames: string[] = [];
for (const c of cases) {
  for (let rep = 0; rep < reps; rep++) {
    const first = await runCase(c.id, c.request, rep, [], c.expect);
    report(first);
    if (c.then && first.proposal) {
      const second = await runCase(`${c.id}#2`, { ...c.request, prompt: c.then.prompt }, rep, [first.proposal]);
      if (second.proposal) second.failedExpectations.push(...compareSecond(first.proposal, second.proposal, !!c.then.sameAgain));
      report(second);
    }
  }
}

const okCount = results.filter((r) => r.ok).length;
const firstTry = results.filter((r) => r.ok && r.attempts.length === 1).length;
const warn = results.filter((r) => r.failedExpectations.length).length;
const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length);
const tokens = results.flatMap((r) => r.attempts).reduce(
  (a, x) => ({ p: a.p + (x.usage?.promptTokens ?? 0), c: a.c + (x.usage?.completionTokens ?? 0) }),
  { p: 0, c: 0 },
);
const costPer = price ? (tokens.p * price.prompt + tokens.c * price.completion) / results.length : null;

const dials = results.flatMap((r) => r.dials ?? []);
const dialLine = dials.length
  ? `  dials in band ${dials.filter((d) => d.off === 0).length}/${dials.length}, opposite ${dials.filter((d) => d.off === 2).length}`
  : "";
const names = nameStats(results.flatMap((r) => (r.name ? [r.name] : [])));
console.log(
  `\nmodel=${model}${reasoning ? ` reasoning=${reasoning}` : ""}  valid ${okCount}/${results.length}  first-try ${firstTry}/${results.length}  expectation-warnings ${warn}  avg ${avgMs}ms` +
    `  tokens/proposal ${Math.round(tokens.p / results.length)} in / ${Math.round(tokens.c / results.length)} out` +
    (costPer !== null ? `  cost/proposal $${costPer.toFixed(4)}` : "") +
    dialLine,
);
console.log(`names: ${names.distinct}/${names.total} distinct` + (names.repeatedWords.length ? `; repeated words: ${names.repeatedWords.join(", ")}` : ""));

mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const out = new URL(`./results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(
  out,
  JSON.stringify(
    { model, reasoning: reasoning ?? null, reps, catalog: catalog.list.map((i) => i.id), price, costPerProposal: costPer, names, results },
    null,
    2,
  ),
);
console.log(`wrote ${out.pathname}`);

function report(r: CaseResult): void {
  results.push(r);
  if (r.name) servedNames.push(r.name);
  const status = r.ok ? (r.failedExpectations.length ? "WARN" : " OK ") : "FAIL";
  console.log(
    `[${status}] ${r.id.padEnd(28)} ${String(r.ms).padStart(5)}ms  ${r.attempts.length} attempt(s)  ${r.name ?? r.error ?? ""}`,
  );
  if (r.recipe) console.log(`       ${r.recipe}`);
  if (r.balance) console.log(`       sugar ${r.balance.sugar.toFixed(1)} acid ${r.balance.acid.toFixed(2)} g/100ml`);
  for (const f of r.failedExpectations) console.log(`       ! ${f}`);
}

async function runCase(
  id: string,
  request: UserRequest,
  rep: number,
  history: Proposal[],
  expect?: EvalCase["expect"],
): Promise<CaseResult> {
  const t0 = Date.now();
  try {
    const { proposal, attempts } = await propose(
      { catalog, request, unavailable: new Set(), recentNames: servedNames.slice(-30).reverse(), history },
      client,
    );
    const ids = new Set(proposal.recipe.map((r) => r.ingredient));
    const failed: string[] = [];
    for (const i of expect?.includes ?? []) if (!ids.has(i)) failed.push(`expected ${i}`);
    for (const i of expect?.excludes ?? []) if (ids.has(i)) failed.push(`did not expect ${i}`);
    if (expect?.mentions && !new RegExp(expect.mentions, "i").test(`${proposal.name} ${proposal.description}`)) {
      failed.push(`expected text matching /${expect.mentions}/`);
    }
    if (!expect?.strongOk) failed.push(...strongFlavourings(proposal, request.adventurousness));

    const b = estimateBalance(proposal.recipe, proposal.glass, catalog);
    const dials: NonNullable<CaseResult["dials"]> = [];
    for (const [dial, asked, pct, bands] of [
      ["sweetness", request.sweetness, b.sugarPct, SWEETNESS_BANDS],
      ["acidity", request.acidity, b.acidPct, ACIDITY_BANDS],
    ] as const) {
      if (!asked) continue;
      const got = levelOf(pct, bands);
      const off = Math.abs(RANK[asked] - RANK[got]);
      dials.push({ dial, asked, got, off });
      if (off) failed.push(`${dial}: asked ${asked}, got ${got}`);
    }

    return {
      id,
      rep,
      ok: true,
      ms: Date.now() - t0,
      attempts,
      proposal,
      name: proposal.name,
      recipe: proposal.recipe
        .map((r) => {
          const ing = catalog.byId.get(r.ingredient);
          return `${ing?.name ?? r.ingredient} ${formatAmount(r, ing)}`;
        })
        .join(", "),
      balance: { sugar: b.sugarPct, acid: b.acidPct },
      dials,
      failedExpectations: failed,
    };
  } catch (e) {
    const attempts = e instanceof ProposeError ? e.attempts : [];
    return { id, rep, ok: false, ms: Date.now() - t0, attempts, failedExpectations: [], error: (e as Error).message };
  }
}

/**
 * In an ordinary order (the guest didn't ask for savoury or weird), vegemite is for adventurousness 3 only. Szechuan peppercorn and celery seed:
 * none at 1, the smallest measure (one pump, two drops) at 2, anything at 3.
 */
function strongFlavourings(p: Proposal, adventurousness: 1 | 2 | 3): string[] {
  const out: string[] = [];
  for (const item of p.recipe) {
    const id = item.ingredient;
    if (id === "vegemite" && adventurousness < 3) out.push(`vegemite at adventurousness ${adventurousness}`);
    if (/szechuan|celery/.test(id)) {
      const unit = catalog.byId.get(id)?.unit;
      const small = item.amount !== "fill" && item.amount <= (unit === "drop" ? 2 : 1);
      if (adventurousness === 1) out.push(`${id} at adventurousness 1`);
      else if (adventurousness === 2 && !small) out.push(`${id} ${item.amount} ${unit} at adventurousness 2`);
    }
  }
  return out;
}

/** Ingredients that carry the drink: everything but garnishes. */
function body(p: Proposal): Set<string> {
  return new Set(p.recipe.map((r) => r.ingredient).filter((i) => catalog.byId.get(i)?.type !== "garnish"));
}

/** A second drink should share little with the first, unless they asked for the same again. */
function compareSecond(first: Proposal, second: Proposal, sameAgain: boolean): string[] {
  const a = body(first);
  const b = body(second);
  const shared = [...a].filter((i) => b.has(i));
  const overlap = shared.length / new Set([...a, ...b]).size;
  const bases = (s: Set<string>) => [...s].filter((i) => catalog.byId.get(i)?.type === "base").sort().join("+");
  if (sameAgain) {
    return overlap < 0.8 ? [`asked for the same again, but only ${Math.round(overlap * 100)}% overlap with "${first.name}"`] : [];
  }
  const out: string[] = [];
  if (overlap >= 0.5) out.push(`${Math.round(overlap * 100)}% overlap with "${first.name}" (${shared.join(", ")})`);
  else if (bases(a) && bases(a) === bases(b)) out.push(`same base as "${first.name}" (${bases(a)})`);
  if (first.name.toLowerCase() === second.name.toLowerCase()) out.push(`same name as the first drink`);
  return out;
}

/** Exact repeats and words that keep coming back (3+ times), case-insensitive. */
function nameStats(all: string[]): { total: number; distinct: number; repeatedWords: string[] } {
  const words = new Map<string, number>();
  for (const n of all) {
    for (const w of new Set(n.toLowerCase().match(/[a-z']+/g) ?? [])) {
      if (!STOPWORDS.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
    }
  }
  return {
    total: all.length,
    distinct: new Set(all.map((n) => n.toLowerCase())).size,
    repeatedWords: [...words]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([w, n]) => `${w} ×${n}`),
  };
}

function loadCatalog(path: string, profile: string): Catalog {
  const json = JSON.parse(readFileSync(path, "utf8")) as
    | Ingredient[]
    | { config: { profiles: Record<string, { ingredients: Ingredient[] }> } };
  const list = Array.isArray(json) ? json : json.config.profiles[profile]?.ingredients;
  if (!list?.length) throw new Error(`no ingredients for profile "${profile}" in ${path}`);
  return makeCatalog(list);
}

/** $ per token for prompt and completion, from OpenRouter's public model list. */
async function fetchPrice(id: string): Promise<{ prompt: number; completion: number } | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const data = (await res.json()) as { data: { id: string; pricing: { prompt: string; completion: string } }[] };
    const m = data.data.find((x) => x.id === id);
    return m ? { prompt: Number(m.pricing.prompt), completion: Number(m.pricing.completion) } : null;
  } catch {
    return null;
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[++i]! : "true";
  }
  return out;
}
