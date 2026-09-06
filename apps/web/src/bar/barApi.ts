import type { Ingredient, Order } from "@sloptail/shared";

/** Mirrors BarView in apps/server/src/bar-do.ts. */
export interface BarView {
  queue: Order[];
  batches: { key: string; label: string; orders: Order[] }[];
  ready: Order[];
  unavailable: string[];
  stats: { queued: number; making: number; ready: number; collected: number; cancelled: number; avgWaitSeconds: number | null };
  recent: Order[];
}

export class BarApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function makeBarApi(token: string) {
  async function call<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`/api/bar${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new BarApiError(res.status, data?.error ?? `HTTP ${res.status}`);
    return data as T;
  }
  return {
    view: () => call<BarView>(""),
    claim: (id: string, bartender: string) => call<Order>(`/orders/${id}/claim`, { bartender }),
    unclaim: (id: string) => call<Order>(`/orders/${id}/unclaim`, {}),
    ready: (id: string) => call<Order>(`/orders/${id}/ready`, {}),
    collected: (id: string) => call<Order>(`/orders/${id}/collected`, {}),
    cancel: (id: string, reason: string) => call<Order>(`/orders/${id}/cancel`, { reason }),
    availability: (ingredient: Ingredient["id"], available: boolean) =>
      call<{ unavailable: string[]; affected: Order[] }>("/availability", { ingredient, available }),
    reset: () => call<{ ok: true }>("/reset", {}),
  };
}

export type BarApi = ReturnType<typeof makeBarApi>;
