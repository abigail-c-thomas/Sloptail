/**
 * The only thing the rest of the package knows about a model: give it a
 * conversation, get text back. Real implementation in openrouter.ts; tests
 * and evals can substitute anything.
 */
export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface CompletionRequest {
  messages: Message[];
  /** JSON schema the model should conform to. Clients may pass it through as response_format. */
  jsonSchema?: { name: string; schema: Record<string, unknown> } | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  signal?: AbortSignal | undefined;
}

export interface Completion {
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number } | undefined;
}

export interface LlmClient {
  complete(req: CompletionRequest): Promise<Completion>;
}

/** Scripted client for tests: returns canned responses in order, records requests. */
export class FakeClient implements LlmClient {
  readonly requests: CompletionRequest[] = [];
  private queue: string[];

  constructor(responses: string[]) {
    this.queue = [...responses];
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    this.requests.push(req);
    const text = this.queue.shift();
    if (text === undefined) throw new Error("FakeClient: no more scripted responses");
    return { text, model: "fake" };
  }
}
