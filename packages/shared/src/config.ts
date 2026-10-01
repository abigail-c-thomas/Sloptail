import type { EventConfig } from "./types.ts";

/**
 * Bring a stored event config up to date before it's parsed. Configs saved
 * before the "dev" profile existed had only practice and real: what was
 * "practice" becomes "dev" (it had been used as one), and practice starts
 * empty. Anything else passes through for EventConfig to judge.
 */
export function migrateConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const c = raw as { active?: string; profiles?: Record<string, unknown> };
  if (!c.profiles || "dev" in c.profiles || !("practice" in c.profiles)) return raw;
  const empty: EventConfig["profiles"]["practice"] = { ingredients: [], printerIp: "" };
  return {
    active: c.active === "practice" ? "dev" : c.active,
    profiles: { ...c.profiles, dev: c.profiles.practice, practice: empty },
  };
}
