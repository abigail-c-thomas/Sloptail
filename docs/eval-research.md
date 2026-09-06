# Eval research: analogous benchmarks and a proposed design

Background research (Sept 2026) for scoring the drink generator and choosing a model.
Summarised from a web survey; URLs are the primary sources.

## 1. Recipe / inventory-constrained generation

- **RecipeNLG** (2.2M recipes) https://aclanthology.org/2020.inlg-1.4/ — BLEU/ROUGE against references are useless for invented drinks, but the "ingredients in, title + directions out" framing matches ours.
- **Cocktail datasets on Hugging Face**: `brianarbuckle/cocktail_recipes` (875 rows, Death & Co style) and `erwanlc/cocktails_recipe` (Difford's scrape with glass and garnish). Reuse: mine real spirit:sour:sweet ratio distributions and glass/garnish vocab for a plausibility check, and as seed "known good" examples. Licences unclear; treat as reference only.
- **Fine-tuning LMs for Recipe Generation** https://arxiv.org/abs/2502.02028 — defines *ingredient coverage* (used ÷ allowed) and a 1–5 judge rubric (clarity, completeness, consistency, practicality, relevance, safety). Metric definitions lift straight over.
- **CommonGen** https://inklab.usc.edu/CommonGen/ — concept-coverage metric is our "only catalog ingredients, includes what was asked for" check.

## 2. Structured output / schema adherence

- **JSONSchemaBench** https://arxiv.org/abs/2501.10868 https://github.com/guidance-ai/jsonschemabench — JSON validity ~98% but schema compliance 91–96% across models. Harness can test *our* schema per model.
- **Structured Output Benchmark (SOB, 2026)** https://arxiv.org/html/2604.25359v1 — "valid JSON ≠ correct JSON": 15–25pt gap between schema compliance and value accuracy. Gemini Flash tier competitive with frontier models on value accuracy. Borrow the metric split: pass rate / schema compliance / type safety / value accuracy.
- **BFCL v4** https://gorilla.cs.berkeley.edu/leaderboard.html — function-call parameter accuracy with cost and latency columns. Fast-tier models are roughly tied with frontier on filling schemas.
- **IFBench** https://artificialanalysis.ai/evaluations/ifbench — verifiable-constraint following, analogous to our strength target and "no citrus" style constraints.

## 3. Creative / interestingness judging

- **EQ-Bench Creative Writing v3** https://eqbench.com/creative_writing.html — hybrid: absolute rubric scores plus pairwise Elo with both orderings averaged, length truncation, explicit anti-"slop" criteria. Reuse the architecture, swap the criteria.
- **LitBench** https://arxiv.org/abs/2507.00769 — off-the-shelf judges agree with humans only ~73% on creative preference. Sets the ceiling.
- **NoveltyBench** https://novelty-bench.github.io — distinct-k over equivalence classes. Directly relevant: does the model give the same gin-lime-something every time? Bigger models were *less* diverse.
- **Position bias** https://arxiv.org/abs/2406.07791 — judges are 0.75–0.82 position-consistent; swap order and average.
- **Anthropic, Demystifying evals** https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents — one judge call per rubric dimension, give the judge an "unknown" exit, start from 20–50 real failures, calibrate with Cohen's kappa on 50–200 human labels (>0.6 usable). Use a judge from a different model family than the generator.

## 4. Fast-tier latency and cost

- **Artificial Analysis** https://artificialanalysis.ai/models — price, tokens/s, time-to-first-token per model.
- **OpenRouter model pages** e.g. https://openrouter.ai/google/gemini-2.5-flash — per-provider P50 latency, throughput, uptime, price. Rankings page is adoption, not quality.
- Nothing published measures ~300-token JSON generation specifically. Measure in our own harness: wall-clock per proposal and cost per call.

## Proposed eval design for Sloptail

**Test set.** ~150 prompts: catalog subset × strength (4 levels) × guest request, including adversarial ones (allergy, "no citrus", asks for something not in the catalog, nonsense). 5 samples per prompt per model.

**Tier 1, code graders (hard gates).** Already partly in `validateRecipe`: schema-valid, every ingredient in catalog, alcohol within the strength budget, volume within glass range, requested ingredient present / excluded absent, ratio sanity against distributions mined from the cocktail datasets. Report pass^k (all 5 valid), not pass@k.

**Tier 2, diversity.** NoveltyBench-style distinct-k across the 5 samples (cluster by base spirit + modifier set) and a cross-prompt duplicate rate.

**Tier 3, LLM judge.** Pairwise against a fixed anchor model, both orders averaged, one call per dimension: request-fit, drinkability/balance, originality, name-and-description charm. Judge from a different family than the generator. Truncate descriptions to neutralise length bias.

**Hand labels.** 100 pairs stratified across strength and request type, labelled by 1–2 tasters; compute kappa against the judge and iterate the rubric until >0.6. Plus ~30 "should adapt or decline" cases (allergy, impossible strength).

**Model pick.** Run tiers 1 and 3 on a Gemini Flash / Flash-Lite, Claude Haiku 4.5, and a GPT mini-class model, logging latency and cost in-harness rather than trusting third-party numbers.
