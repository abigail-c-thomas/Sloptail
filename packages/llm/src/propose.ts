import { describeIssue, flavourIssues, validateRecipe, type Proposal } from "@sloptail/shared";
import type { LlmClient, Message } from "./client.ts";
import { ParseError, parseProposal, PROPOSAL_JSON_SCHEMA } from "./parse.ts";
import { editMessages, proposeMessages, repairMessages, type PromptContext } from "./prompt.ts";

export interface Attempt {
  raw: string;
  model: string;
  problems: string[];
  usage?: { promptTokens: number; completionTokens: number } | undefined;
}

export interface ProposeResult {
  proposal: Proposal;
  /** Every model round-trip, including failed ones. Useful for evals. */
  attempts: Attempt[];
}

export interface ProposeOptions {
  /** How many repair round-trips to allow after the first try. Default 2. */
  maxRepairs?: number | undefined;
  temperature?: number | undefined;
  signal?: AbortSignal | undefined;
}

export class ProposeError extends Error {
  readonly attempts: Attempt[];
  constructor(message: string, attempts: Attempt[]) {
    super(message);
    this.name = "ProposeError";
    this.attempts = attempts;
  }
}

/** Ask the model for a drink for this guest. Pure apart from the injected client. */
export function propose(ctx: PromptContext, client: LlmClient, opts: ProposeOptions = {}): Promise<ProposeResult> {
  return runWithRepairs(proposeMessages(ctx), ctx, client, opts);
}

/** Ask the model to tweak an existing proposal. */
export function edit(
  ctx: PromptContext,
  previous: Proposal,
  tweak: string,
  client: LlmClient,
  opts: ProposeOptions = {},
): Promise<ProposeResult> {
  // The tweak ("sweeter please") outranks the original flavour dials, so don't hold the edit to them.
  const loose = { ...ctx, request: { ...ctx.request, sweetness: undefined, acidity: undefined } };
  return runWithRepairs(editMessages(ctx, previous, tweak), loose, client, opts);
}

/** Validate a proposal the way the loop does; exported so evals can score model output. */
export function problemsWith(proposal: Proposal, ctx: PromptContext): string[] {
  return [...hardProblems(proposal, ctx), ...flavourIssues(proposal.recipe, proposal.glass, ctx.request, ctx.catalog)];
}

/** What makes a recipe unservable, as opposed to missing the flavour dials. */
function hardProblems(proposal: Proposal, ctx: PromptContext): string[] {
  return validateRecipe(proposal.recipe, ctx.request.strength, ctx.catalog, ctx.unavailable).map(describeIssue);
}

async function runWithRepairs(
  messages: Message[],
  ctx: PromptContext,
  client: LlmClient,
  opts: ProposeOptions,
): Promise<ProposeResult> {
  const attempts: Attempt[] = [];
  const maxRepairs = opts.maxRepairs ?? 2;
  let current = messages;
  // Some dials can't be hit with what's on the bar (a dry mocktail when every
  // soft mixer is sugary). A drink that's only off on flavour beats an error.
  let closest: Proposal | undefined;

  for (let i = 0; i <= maxRepairs; i++) {
    const completion = await client.complete({
      messages: current,
      jsonSchema: { name: "proposal", schema: PROPOSAL_JSON_SCHEMA },
      temperature: opts.temperature,
      signal: opts.signal,
    });

    let problems: string[];
    let proposal: Proposal | undefined;
    try {
      proposal = parseProposal(completion.text);
      problems = problemsWith(proposal, ctx);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      problems = [e.message];
    }

    attempts.push({ raw: completion.text, model: completion.model, problems, usage: completion.usage });
    if (proposal && problems.length === 0) return { proposal, attempts };
    if (proposal && hardProblems(proposal, ctx).length === 0) closest = proposal;
    current = repairMessages(current, completion.text, problems);
  }

  if (closest) return { proposal: closest, attempts };
  throw new ProposeError(`Model could not produce a valid recipe after ${attempts.length} attempts`, attempts);
}
