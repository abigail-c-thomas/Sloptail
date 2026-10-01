# Sloptail

AI cocktail ordering for a work happy hour. Guests order from their phones at
the deployed URL, a model invents a drink, two bartenders work from the bar
screen. Design notes in `Sloptail/Design.md`; open work in `TODO.md`.

## Layout

```
packages/shared   types, zod schemas, ingredient catalog, classics, recipe validation
packages/state    pure order state machine + selectors (no I/O)
packages/llm      prompts, propose/edit loop, OpenRouter client, evals
packages/ui       React components + stylesheet
apps/server       Cloudflare Worker (Hono) + one Durable Object holding bar state
apps/web          Vite + React SPA: `/` guests, `/bar` bartenders
scripts/load.ts   load test against a running server
```

## Commands

```bash
npm install
npm test            # node --test, no network
npm run typecheck   # tsc -b
npm run dev         # wrangler dev :8787 + vite :5173 (vite proxies /api)
npm run deploy      # build SPA, deploy worker + assets to Cloudflare
npm run eval -- --model <openrouter id> --reps 2   # real model calls, costs money
```

## Deploying

`npm run deploy` from the repo root. Wrangler is logged in machine-wide via
OAuth (`npx wrangler login` from `apps/server` if `npx wrangler whoami` says
otherwise). Production secrets live in Cloudflare, not in the repo:

```bash
cd apps/server
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put BAR_TOKEN
```

Non-secret config (model ids, reasoning effort) is in `apps/server/wrangler.jsonc`.
Local dev reads `apps/server/.dev.vars` (gitignored; copy from `.dev.vars.example`).
Secret values and the live URLs are in `CLAUDE.local.md` (gitignored). Never put
them in this file, the README, or anything committed: the repo is public.

## Conventions

- **Minimal dependencies.** Runtime: react, react-dom, hono, zod. Tooling:
  typescript, vite, wrangler. Node's own test runner and type stripping; no
  router, no CSS framework, no React plugin. Check `npm ls --all` impact before
  adding anything and prefer a platform built-in.
- Relative imports use explicit `.ts` / `.tsx` extensions so Node can run the
  packages directly. No TypeScript parameter properties (type stripping).
- **Background anything slow** (evals, servers, load tests) and keep talking.
  Propose eval sweeps before running them; they cost money.
- Server owns all model calls. The browser never sees the API key.
- Everything is built in the glass: no shake/stir, highball or rocks only.
  Full strength is a standard cocktail (≤22 ml pure alcohol, 10% tolerance).
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
