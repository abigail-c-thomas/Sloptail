import type { BarDO } from "./bar-do.ts";

export interface Env {
  BAR: DurableObjectNamespace<BarDO>;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_FALLBACK_MODELS?: string;
  /** none | low | medium | high; see OpenRouterOptions.reasoning */
  OPENROUTER_REASONING?: string;
  /** Shared secret the bar screen sends as a bearer token. */
  BAR_TOKEN: string;
}
