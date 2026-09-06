import type { BarDO } from "./bar-do.js";

export interface Env {
  BAR: DurableObjectNamespace<BarDO>;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_FALLBACK_MODELS?: string;
  /** Shared secret the bar screen sends as a bearer token. */
  BAR_TOKEN: string;
}
