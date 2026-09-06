import { describeIssue, validateRecipe, type Proposal } from "@sloptail/shared";
import type { LlmClient, Message } from "./client.ts";
import { ParseError, parseProposal, PROPOSAL_JSON_SCHEMA } from "./parse.ts";
import { editMessages, proposeMessages, repairMessages, type PromptContext } from "./prompt.ts";

export interface Attempt {
  raw: string;
  model: string;
  problems: string[];
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
  return runWithRepairs(editMessages(ctx, previous, tweak), ctx, client, opts);
}

/** Validate a proposal the way the loop does; exported so evals can score model output. */
export function problemsWith(proposal: Proposal, ctx: PromptContext): string[] {
  return validateRecipe(proposal.recipe, ctx.request.strength, ctx.unavailable).map(describeIssue);
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

    attempts.push({ raw: completion.text, model: completion.model, problems });
    if (proposal && problems.length === 0) return { proposal, attempts };
    current = repairMessages(current, completion.text, problems);
  }

  throw new ProposeError(`Model could not produce a valid recipe after ${attempts.length} attempts`, attempts);
}
