import type { EditBody, Ingredient, Order, Proposal, ProposeBody, SubmitBody } from "@sloptail/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`/api${path}`, { ...init, headers });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export interface ProposeResponse {
  proposal: Proposal;
  attempts: number;
}

/** Mirrors NamedGuest in packages/state/src/selectors.ts. */
export interface NamedGuest {
  userId: string;
  drink: string;
  orderId: string;
  status: Order["status"];
}

/** Mirrors Board in packages/state/src/selectors.ts. */
export interface Board {
  inProgress: { userName: string; drink: string }[];
  ready: { userName: string; drink: string }[];
}

export const api = {
  propose: (b: ProposeBody) => call<ProposeResponse>("/propose", post(b)),
  edit: (b: EditBody) => call<ProposeResponse>("/edit", post(b)),
  submit: (b: SubmitBody) => call<Order>("/orders", post(b)),
  order: (id: string) => call<Order>(`/orders/${id}`),
  collect: (id: string, userId: string) => call<Order>(`/orders/${id}/collected`, post({ userId })),
  board: () => call<Board>("/board"),
  catalog: () => call<{ catalog: Ingredient[]; unavailable: string[] }>("/catalog"),
  userOrders: (userId: string) => call<Order[]>(`/users/${userId}/orders`),
  guestsNamed: (name: string) => call<NamedGuest[]>(`/guests?name=${encodeURIComponent(name)}`),
};
