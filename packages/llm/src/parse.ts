import { Proposal } from "@sloptail/shared";
import { z } from "zod";

/** JSON schema handed to the model. Derived from the zod type so they can't drift. */
export const PROPOSAL_JSON_SCHEMA = z.toJSONSchema(Proposal) as Record<string, unknown>;

export class ParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "ParseError";
    this.raw = raw;
  }
}

/** Pull the first JSON object out of a response, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) throw new ParseError("No JSON object found", text);
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (e) {
      throw new ParseError(`Invalid JSON: ${(e as Error).message}`, text);
    }
  }
}

export function parseProposal(text: string): Proposal {
  const json = extractJson(text);
  const result = Proposal.safeParse(json);
  if (!result.success) {
    throw new ParseError(`Proposal failed schema: ${z.prettifyError(result.error)}`, text);
  }
  return result.data;
}
