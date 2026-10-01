import type { EventConfig, Ingredient, Profile, ProfileName } from "@sloptail/shared";
import { call } from "../api.ts";
import type { StockLevel } from "../bar/barApi.ts";

/** Mirrors AdminView in apps/server/src/bar-do.ts. */
export interface AdminView {
  config: EventConfig;
  stats: { queued: number; making: number; ready: number; collected: number; cancelled: number; avgWaitSeconds: number | null };
  stock: StockLevel[];
}

export function makeAdminApi(token: string) {
  const send = <T,>(path: string, method = "GET", body?: unknown) =>
    call<T>(`/admin${path}`, { method, token, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return {
    view: () => send<AdminView>(""),
    save: (name: ProfileName, profile: Profile) => send<AdminView>(`/profiles/${name}`, "PUT", profile),
    describe: (names: string[]) => send<{ ingredients: Ingredient[]; failed: string[] }>("/describe", "POST", { names }),
    start: (profile: ProfileName) => send<AdminView>("/start", "POST", { profile }),
  };
}
