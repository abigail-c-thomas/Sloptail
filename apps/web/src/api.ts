import type { EditBody, Order, Proposal, ProposeBody, SubmitBody } from "@sloptail/shared";

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

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
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

export const api = {
  propose: (b: ProposeBody) => call<ProposeResponse>("/propose", post(b)),
  edit: (b: EditBody) => call<ProposeResponse>("/edit", post(b)),
  submit: (b: SubmitBody) => call<Order>("/orders", post(b)),
  order: (id: string) => call<Order>(`/orders/${id}`),
  userOrders: (userId: string) => call<Order[]>(`/users/${userId}/orders`),
};
