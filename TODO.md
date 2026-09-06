# Sloptail TODO

Legend: **[you]** needs Abigail · **[claude]** Claude can do alone · **[both]** work through together

## 1. Get a real model in the loop

- [ ] **[you]** Create an OpenRouter key and put it in `apps/server/.dev.vars` as `OPENROUTER_API_KEY` (copy `.dev.vars.example`).
- [ ] **[you]** Pick 3-4 candidate models to compare (your guess: a fast Gemini Flash tier; plus a Claude and one other). Exact OpenRouter ids are at openrouter.ai/models.
- [ ] **[claude]** Run `npm run eval -- --model <id> --reps 3` per candidate; report validity, first-try rate, latency, and cost per proposal.
- [ ] **[both]** Read the actual drinks. Decide default + fallback model, set them in `apps/server/wrangler.jsonc`.
- [ ] **[claude]** First prompt iteration from whatever the eval turns up.

## 2. Ingredients

- [ ] **[you]** List what the bar will actually stock (spirits, mixers, syrups, bitters, garnishes) and roughly how much. A plain text list is fine.
- [ ] **[claude]** Replace the placeholder catalog in `packages/shared/src/catalog.ts`, re-check the classics still work, update tests.
- [ ] **[you]** Any house rules for the model: max spirit per drink, things to never combine, anything that needs a shaker vs. can be built in the glass.

## 3. Deploy

- [ ] **[you]** Create a Cloudflare account (free tier is enough) and run `npx wrangler login` on this machine.
- [ ] **[claude]** First deploy: `wrangler secret put` for `OPENROUTER_API_KEY` and `BAR_TOKEN`, `npm run deploy`, confirm the Durable Object migration applies.
- [ ] **[you]** Decide the URL: the default `sloptail.<account>.workers.dev` or a custom domain you own.
- [ ] **[you]** Open it on your phone on the venue guest wifi. Report whether it loads and whether a proposal comes back.
- [ ] **[claude]** Load script: 70 concurrent guests placing orders, check nothing falls over and OpenRouter doesn't rate-limit.

## 4. Evals (together)

- [ ] **[both]** Agree what "good drink" means well enough to score it: a rubric (balanced, matches the request, makeable in 90s, not a cliché at level 3).
- [ ] **[claude]** Add a judge pass to the eval runner using that rubric, scored by a second model, with a small human-labelled set to sanity-check the judge.
- [ ] **[both]** Grow `packages/llm/evals/cases.ts` from real requests as they come in during rehearsals.
- [ ] **[claude]** Track eval results across prompt versions so we can see regressions.

## 5. UX (together)

- [ ] **[both]** Walk the guest flow on a phone together, note what's confusing or slow.
- [ ] **[you]** Tone check on the microcopy: the loading lines, the strength hints, the footer. Tell me what to cut.
- [ ] **[you]** What device the bar will actually have (laptop? tablet? phone propped up?) and how many bartenders.
- [ ] **[both]** Redesign the bar screen for that device. Currently a readable three-column placeholder.
- [ ] **[claude]** Streaming or progress feedback during the model call if latency is over ~4s.
- [ ] **[claude]** QR code page / slide for the auditorium.

## 6. Logistics questions the software can't answer

- [ ] **[you]** Parallel bartenders each taking a batch, or one making everything? The bar screen supports either; batching is tuned for "one person builds 2-3 similar drinks at once".
- [ ] **[you]** Do we want names shouted, or a number system? Currently names.
- [ ] **[both]** Rehearsal with a handful of colleagues a week out. This will generate most of sections 4 and 5.

## Done

- [x] Repo, monorepo layout, dependency trim
- [x] Types, catalog (placeholder), classics, recipe validation
- [x] Pure state machine + batching, tested
- [x] LLM propose/edit loop with repairs, tested against a fake model
- [x] Worker + Durable Object + all API routes, smoke-tested
- [x] Guest flow, tracking, past orders; bar screen v1
- [x] Eval runner skeleton
