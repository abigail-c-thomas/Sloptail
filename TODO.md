# Sloptail TODO

Legend: **[you]** needs Abigail · **[claude]** Claude can do alone · **[both]** work through together

## 1. Get a real model in the loop

- [ ] **[you]** Create an OpenRouter key and put it in `apps/server/.dev.vars` as `OPENROUTER_API_KEY` (copy `.dev.vars.example`).
- [ ] **[both]** Agree the eval design before running a sweep (Abigail: not there yet). Candidates on OpenRouter: `google/gemini-3.8-flash`, `google/gemini-3.5-flash-lite`, `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-5`, `openai/gpt-5.4-mini`.
- [x] **[claude]** Baseline run on `anthropic/claude-opus-5` (old catalog): 20/20 valid, 18/20 first try, avg 9.1s per proposal. Slow for a phone; low diversity at level 3 (tequila + saline + chilli almost every time).
- [x] **[claude]** Sweep done on the real catalog; results in `packages/llm/evals/results/`.
- [x] **[both]** Decided: GPT 5.6 Luna default (more varied, ~4s), Gemini 3.8 Flash fallback (~2s but samey), Haiku second fallback. Low reasoning effort.
- [ ] **[claude]** Prompt tweaks if needed: vary the base spirit unless named; feed recent drinks into the prompt for diversity. Low priority with Luna.

## 2. Ingredients

- [x] **[you]** List what the bar will actually stock: `Sloptail/Ingredients.md`.
- [x] **[claude]** Catalog rebuilt from that list; classics rewritten as built-in-glass highballs; tests updated.
- [ ] **[you]** Open questions from the list: vermouth in or out? Cream/yogurt vs lactic acid solution (I've assumed the solution)? Rough quantities per bottle, so we can do out-of-stock estimates?
- [x] **[you]** House rules: standard cocktail strength max (20-22ml pure alcohol), everything built in the glass, no shaking. Applied.

## 3. Deploy

- [x] **[you]** Create a Cloudflare account (free tier is enough).
- [x] **[you]** Authorise wrangler.
- [x] **[claude]** First deploy: https://sloptail.sloptail-server.workers.dev (bar: `/bar?token=…`, token shared in chat). Secrets set.
- [x] **[claude]** Per-device rate limit (8/min) and global cap (120/min) on model endpoints; robots noindex.
- [ ] **[you]** Decide the URL: the default `sloptail.<account>.workers.dev` or a custom domain you own.
- [ ] **[you]** Open it on your phone on the venue guest wifi. Report whether it loads and whether a proposal comes back.
- [x] **[claude]** Load test against the live site with model calls: 70 guests in 33s, 0 failures; propose p50 4.3s / p95 6.9s / max 15s; everything else under 100ms.

## 4. Evals (together)

- [x] **[claude]** Research analogous evals: see `docs/eval-research.md`.
- [ ] **[both]** Agree what "good drink" means well enough to score it: a rubric (balanced, matches the request, makeable in 90s, not a cliché at level 3). Start from the proposed design in `docs/eval-research.md`.
- [ ] **[claude]** Tier 1 code graders + diversity metric in the eval runner (no model needed to judge).
- [ ] **[claude]** Add a pairwise judge pass using the rubric, scored by a different model family, both orderings averaged.
- [ ] **[you]** Hand-label ~100 pairs (a taster or two) so we can measure judge agreement.
- [ ] **[both]** Grow `packages/llm/evals/cases.ts` from real requests as they come in during rehearsals.
- [ ] **[claude]** Track eval results across prompt versions so we can see regressions.

## 5. UX (together)

- [ ] **[both]** Walk the guest flow on a phone together, note what's confusing or slow.
- [ ] **[you]** Tone check on the microcopy: the loading lines, the strength hints, the footer. Tell me what to cut.
- [x] **[you]** Two bartenders.
- [ ] **[you]** What device(s) at the bar: one shared laptop/tablet, or a phone each? Shapes the bar screen layout.
- [ ] **[both]** Redesign the bar screen for that device. Currently a readable three-column placeholder.
- [ ] **[claude]** Streaming or progress feedback during the model call if latency is over ~4s.
- [ ] **[claude]** QR code page / slide for the auditorium.

## 6. Logistics questions the software can't answer

- [x] **[you]** Parallel bartenders, each taking a batch. Batching groups by base + mixer.
- [x] **[you]** Names shouted, not numbers.
- [ ] **[both]** Rehearsal with a handful of colleagues a week out. This will generate most of sections 4 and 5.

## Done

- [x] Repo, monorepo layout, dependency trim
- [x] Types, catalog (placeholder), classics, recipe validation
- [x] Pure state machine + batching, tested
- [x] LLM propose/edit loop with repairs, tested against a fake model
- [x] Worker + Durable Object + all API routes, smoke-tested
- [x] Guest flow, tracking, past orders; bar screen v1
- [x] Eval runner skeleton
