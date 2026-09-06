# Sloptail

AI cocktail ordering for a happy-hour demo. Guests order from their phones, a
language model invents a drink for each of them, the bar screen tells the
bartenders what to make and in what order. Design notes: [Sloptail/Design.md](Sloptail/Design.md).

## Layout

```
packages/shared   types, zod schemas, ingredient catalog, classics, recipe validation
packages/state    pure order state machine (no I/O) + selectors (queue, batches, stats)
packages/llm      prompts, propose/edit loop with validation-driven repairs, OpenRouter client, evals
packages/ui       React component library + stylesheet
apps/server       Cloudflare Worker (Hono) + one Durable Object holding the bar state
apps/web          Vite + React SPA: `/` for guests, `/bar` for the bar
```

Everything is TypeScript. The server owns all model calls; the browser never
sees the API key.

## Dependencies

Kept deliberately small. Runtime: `react`, `react-dom`, `hono`, `zod`.
Tooling: `typescript`, `vite`, `wrangler`, plus type packages. Tests use
Node's built-in runner (`node --test`) and Node's native TypeScript type
stripping, so there is no test framework or TS loader. No router, no CSS
framework, no React build plugin. Before adding anything, check what it pulls
in with `npm ls --all` and prefer a platform built-in.

## Running locally

```bash
npm install
cp apps/server/.dev.vars.example apps/server/.dev.vars   # then fill in OPENROUTER_API_KEY
npm run dev
```

That starts `wrangler dev` on :8787 and Vite on :5173 (Vite proxies `/api` to
wrangler). Open http://localhost:5173 for the guest flow and
http://localhost:5173/bar?token=dev for the bar screen.

Other scripts:

```bash
npm test          # node --test: state machine + llm loop (no network)
npm run typecheck # tsc across all packages
npm run eval      # sends eval cases through a real model; needs OPENROUTER_API_KEY
```

## Deploying

```bash
npx wrangler login                       # once
cd apps/server
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put BAR_TOKEN
cd ../..
npm run deploy                           # builds the SPA, deploys worker + assets
```

Model choice lives in `apps/server/wrangler.jsonc` (`OPENROUTER_MODEL`,
`OPENROUTER_FALLBACK_MODELS`). Bar screen: `https://<your-worker>/bar?token=<BAR_TOKEN>`.

## How the pieces fit

- A guest's phone posts a `UserRequest` to `/api/propose`. The Worker builds a
  prompt from the catalog minus whatever the bar has run out of, calls the model,
  validates the JSON against the zod schema and the recipe rules (only known
  ingredients, alcohol within the requested strength, sane amounts) and, if it
  fails, sends the problems back to the model for up to two repair rounds.
- `/api/orders` hands the proposal to the Durable Object, which applies the
  pure `submitOrder` function and persists the new state. The phone then polls
  `/api/orders/:id` until it's `ready`.
- The bar screen polls `/api/bar` and sees queued orders grouped into batches
  that share a base spirit, mixer and method, so one bartender can build
  several at once. Claim, ready, collected and cancel are all state-machine
  transitions.
- Marking an ingredient out of stock removes it from future prompts, blocks
  new orders that use it, and reports which live orders are affected.

## Evals

`packages/llm/evals/cases.ts` holds representative guest requests, some with
expectations (must include tequila, must not include gin). `npm run eval`
runs them through the real model, prints validity and repair counts, and writes
a JSON transcript to `packages/llm/evals/results/`. Add a case whenever a real
request produces something bad.
