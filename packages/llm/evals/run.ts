/**
 * Eval runner: sends every case through `propose` against a real model and
 * reports validity, repair rate, latency, and the heuristic expectations.
 *
 *   OPENROUTER_API_KEY=... npm run eval -- [--model x] [--reps 2] [--only id]
 *
 * Results are written to evals/results/<timestamp>.json (gitignored) so runs
 * can be diffed by hand or fed to a judge later.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { CATALOG_BY_ID, formatAmount } from "@sloptail/shared";
import { OpenRouterClient } from "../src/openrouter.ts";
import { propose, ProposeError, type Attempt } from "../src/propose.ts";
import { CASES, type EvalCase } from "./cases.ts";

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not set");
  process.exit(1);
}
const model = args.model ?? process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-5";
const reps = Number(args.reps ?? 1);
const cases = args.only ? CASES.filter((c) => c.id === args.only) : CASES;

const client = new OpenRouterClient({ apiKey, model, appName: "sloptail-evals" });

interface CaseResult {
  id: string;
  rep: number;
  ok: boolean;
  ms: number;
  attempts: Attempt[];
  name?: string;
  recipe?: string;
  failedExpectations: string[];
  error?: string;
}

const results: CaseResult[] = [];
for (const c of cases) {
  for (let rep = 0; rep < reps; rep++) {
    results.push(await runCase(c, rep));
    const r = results.at(-1)!;
    const status = r.ok ? (r.failedExpectations.length ? "WARN" : " OK ") : "FAIL";
    console.log(
      `[${status}] ${c.id.padEnd(24)} ${String(r.ms).padStart(5)}ms  ${r.attempts.length} attempt(s)  ${r.name ?? r.error ?? ""}`,
    );
    if (r.recipe) console.log(`       ${r.recipe}`);
    for (const f of r.failedExpectations) console.log(`       ! ${f}`);
  }
}

const okCount = results.filter((r) => r.ok).length;
const firstTry = results.filter((r) => r.ok && r.attempts.length === 1).length;
const warn = results.filter((r) => r.failedExpectations.length).length;
const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length);
console.log(`\nmodel=${model}  valid ${okCount}/${results.length}  first-try ${firstTry}/${results.length}  expectation-warnings ${warn}  avg ${avgMs}ms`);

mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const out = new URL(`./results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(out, JSON.stringify({ model, reps, results }, null, 2));
console.log(`wrote ${out.pathname}`);

async function runCase(c: EvalCase, rep: number): Promise<CaseResult> {
  const t0 = Date.now();
  try {
    const { proposal, attempts } = await propose(
      { userName: c.userName, request: c.request, unavailable: new Set() },
      client,
    );
    const ids = new Set(proposal.recipe.map((r) => r.ingredient));
    const failed: string[] = [];
    for (const id of c.expect?.includes ?? []) if (!ids.has(id)) failed.push(`expected ${id}`);
    for (const id of c.expect?.excludes ?? []) if (ids.has(id)) failed.push(`did not expect ${id}`);
    if (c.expect?.mentions && !new RegExp(c.expect.mentions, "i").test(`${proposal.name} ${proposal.description}`)) {
      failed.push(`expected text matching /${c.expect.mentions}/`);
    }
    return {
      id: c.id,
      rep,
      ok: true,
      ms: Date.now() - t0,
      attempts,
      name: proposal.name,
      recipe: proposal.recipe
        .map((r) => `${CATALOG_BY_ID.get(r.ingredient)?.name ?? r.ingredient} ${formatAmount(r, CATALOG_BY_ID.get(r.ingredient))}`)
        .join(", "),
      failedExpectations: failed,
    };
  } catch (e) {
    const attempts = e instanceof ProposeError ? e.attempts : [];
    return { id: c.id, rep, ok: false, ms: Date.now() - t0, attempts, failedExpectations: [], error: (e as Error).message };
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
