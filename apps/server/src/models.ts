import { OpenRouterClient } from "@sloptail/llm";
import type { Env } from "./env.ts";

type Reasoning = "none" | "low" | "medium" | "high";

/** The model that designs drinks. */
export function llm(env: Env): OpenRouterClient {
  return new OpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna",
    fallbackModels: env.OPENROUTER_FALLBACK_MODELS?.split(",").map((s) => s.trim()).filter(Boolean),
    appName: "sloptail",
    reasoning: env.OPENROUTER_REASONING as Reasoning | undefined,
  });
}

/**
 * The ticket picture: ART_MODEL if set, else the drink model. It runs in the
 * background after an order is in, so it can afford to think a little longer.
 */
export function artLlm(env: Env): OpenRouterClient {
  return new OpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.ART_MODEL ?? env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna",
    fallbackModels: env.OPENROUTER_FALLBACK_MODELS?.split(",").map((s) => s.trim()).filter(Boolean),
    appName: "sloptail",
    reasoning: (env.ART_REASONING ?? "medium") as Reasoning,
    timeoutMs: 90_000,
  });
}
