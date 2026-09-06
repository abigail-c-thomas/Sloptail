import type { Completion, CompletionRequest, LlmClient } from "./client.js";

export interface OpenRouterOptions {
  apiKey: string;
  /** Primary model id, e.g. "anthropic/claude-opus-5". */
  model: string;
  /** Tried in order if the primary is unavailable. */
  fallbackModels?: string[] | undefined;
  /** Per-request timeout. Default 25s. */
  timeoutMs?: number | undefined;
  /** Attach response_format json_schema. Some models reject it; default true. */
  useJsonSchema?: boolean | undefined;
  /** Optional attribution headers OpenRouter shows in its dashboard. */
  appName?: string | undefined;
  appUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export class OpenRouterError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

/**
 * Minimal OpenRouter chat-completions client over fetch. No SDK so it runs
 * identically in Workers, Node and tests.
 */
export class OpenRouterClient implements LlmClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: OpenRouterOptions) {
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    const body: Record<string, unknown> = {
      model: this.opts.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.8,
      max_tokens: req.maxTokens ?? 800,
    };
    if (this.opts.fallbackModels?.length) body.models = [this.opts.model, ...this.opts.fallbackModels];
    if (req.jsonSchema && (this.opts.useJsonSchema ?? true)) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: req.jsonSchema.name, strict: false, schema: req.jsonSchema.schema },
      };
    }

    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? 25_000);
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.opts.appUrl) headers["HTTP-Referer"] = this.opts.appUrl;
    if (this.opts.appName) headers["X-Title"] = this.opts.appName;

    const res = await this.fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OpenRouterError(res.status, `OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };
    if (data.error) throw new OpenRouterError(res.status, data.error.message ?? "unknown error");
    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      text,
      model: data.model ?? this.opts.model,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }
}
