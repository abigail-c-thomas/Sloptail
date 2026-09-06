/**
 * Load test: N virtual guests hit the deployed app at once.
 *
 *   node scripts/load.ts --url https://sloptail.sloptail-server.workers.dev --users 70 [--llm] [--token BAR_TOKEN]
 *
 * Without --llm each guest orders a classic straight away (no model cost),
 * which exercises the Durable Object, ordering, polling and the bar view.
 * With --llm each guest also calls /api/propose first, which is the real
 * path and costs real money (~$0.001 per guest on Luna).
 *
 * Reports latency percentiles per endpoint and any non-2xx responses.
 */
import { classicsFor, type Order, type Proposal, type UserRequest } from "@sloptail/shared";

const args = parseArgs(process.argv.slice(2));
const base = (args.url ?? "http://localhost:8787").replace(/\/$/, "");
const users = Number(args.users ?? 70);
const useLlm = args.llm === "true";
const token = args.token;

const timings: Record<string, number[]> = {};
const failures: string[] = [];

async function call<T>(label: string, path: string, init?: RequestInit): Promise<T | null> {
  const t0 = performance.now();
  try {
    const res = await fetch(base + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
    });
    (timings[label] ??= []).push(performance.now() - t0);
    if (!res.ok) {
      failures.push(`${label} ${res.status} ${(await res.text()).slice(0, 120)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    (timings[label] ??= []).push(performance.now() - t0);
    failures.push(`${label} ${(e as Error).message}`);
    return null;
  }
}

const STRENGTHS: UserRequest["strength"][] = ["zero", "trace", "half", "full"];
const PROMPTS = ["something citrusy", "smoky and weird", "not too sweet", "surprise me", "tastes like a holiday", ""];

async function guest(i: number): Promise<void> {
  const userId = `load-${Date.now()}-${i}`;
  const userName = `Guest ${i}`;
  const strength = STRENGTHS[i % STRENGTHS.length]!;
  const request: UserRequest = { strength, adventurousness: ((i % 3) + 1) as 1 | 2 | 3, prompt: PROMPTS[i % PROMPTS.length]! };

  // Stagger arrivals over ~10s like a real crowd scanning a QR code.
  await sleep(Math.random() * 10_000);

  let proposal: Proposal | undefined;
  if (useLlm) {
    const r = await call<{ proposal: Proposal }>("propose", "/api/propose", {
      method: "POST",
      body: JSON.stringify({ userId, userName, request }),
    });
    proposal = r?.proposal;
  }
  if (!proposal) {
    const classics = classicsFor(strength);
    proposal = classics[i % classics.length]!.proposal;
  }

  const order = await call<Order>("submit", "/api/orders", {
    method: "POST",
    body: JSON.stringify({ userId, userName, request, proposal }),
  });
  if (!order) return;

  // Poll like the phone does, a few times.
  for (let p = 0; p < 3; p++) {
    await sleep(3000);
    await call<Order>("poll", `/api/orders/${order.id}`);
  }
}

async function barWatcher(): Promise<void> {
  if (!token) return;
  for (let i = 0; i < 10; i++) {
    await call("bar-view", "/api/bar");
    await sleep(2000);
  }
}

const t0 = performance.now();
await Promise.all([...Array.from({ length: users }, (_, i) => guest(i)), barWatcher()]);
const wall = ((performance.now() - t0) / 1000).toFixed(1);

console.log(`\n${users} guests${useLlm ? " with model calls" : " (classics only)"} against ${base} in ${wall}s\n`);
console.log("endpoint    n     p50     p95     max");
for (const [label, arr] of Object.entries(timings)) {
  const s = [...arr].sort((a, b) => a - b);
  const q = (f: number) => Math.round(s[Math.min(s.length - 1, Math.floor(f * s.length))]!);
  console.log(`${label.padEnd(10)} ${String(s.length).padStart(3)} ${String(q(0.5)).padStart(6)}ms ${String(q(0.95)).padStart(6)}ms ${String(Math.round(s.at(-1)!)).padStart(6)}ms`);
}
console.log(`\nfailures: ${failures.length}`);
for (const f of failures.slice(0, 15)) console.log("  " + f);
if (token) console.log("\nRemember to hit /api/bar/reset to clear the load-test orders.");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[++i]! : "true";
  }
  return out;
}
