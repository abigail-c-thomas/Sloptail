import type { BarDO } from "./bar-do.ts";

export interface Env {
  BAR: DurableObjectNamespace<BarDO>;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_FALLBACK_MODELS?: string;
  /** none | low | medium | high; see OpenRouterOptions.reasoning */
  OPENROUTER_REASONING?: string;
  /** Reasoning effort for the ticket drawing; default medium. */
  ART_REASONING?: string;
  /** Shared secret the bar screen sends as a bearer token. */
  BAR_TOKEN: string;
  /** Secret for /admin. Falls back to BAR_TOKEN if unset. */
  ADMIN_TOKEN?: string;
}
