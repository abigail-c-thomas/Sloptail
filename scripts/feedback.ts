/**
 * Guest feedback, for a Claude Code session. The bar marks feedback "Do"
 * (status todo); a session picks it up, fixes it, deploys, and closes it.
 *
 *   npm run feedback -- watch                  # prints each todo item once, as it arrives (run in the background)
 *   npm run feedback -- list [--status todo,working]
 *   npm run feedback -- start <id>             # "Claude's on it" on the bar screen
 *   npm run feedback -- done <id> --note "Fixed in abc123, deployed"
 *   npm run feedback -- wont <id> --note "Needs a shaker; everything's built in the glass"
 *
 * Token from --token or SLOPTAIL_BAR_TOKEN; site from --url or SLOPTAIL_URL
 * (default https://sloptail.com). Node built-ins only.
 */
import { parseArgs } from "node:util";
import type { Feedback } from "@sloptail/shared";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", default: process.env.SLOPTAIL_URL ?? "https://sloptail.com" },
    token: { type: "string", default: process.env.SLOPTAIL_BAR_TOKEN },
    status: { type: "string" },
    note: { type: "string", default: "" },
    every: { type: "string", default: "15" },
  },
});
const [command, id] = positionals;
// Errors are for a person or a session to read: the message, not a stack.
process.on("uncaughtException", (e) => {
  console.error(`feedback: ${e.message}`);
  process.exit(1);
});
const base = opts.url.replace(/\/$/, "");

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!opts.token) throw new Error("No bar token: pass --token or set SLOPTAIL_BAR_TOKEN");
  const res = await fetch(`${base}/api/bar${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(`${res.status} ${data?.error ?? res.statusText}`);
  return data;
}

function show(f: Feedback): string {
  const when = new Date(f.createdAt).toLocaleString();
  const where = f.context ? `, on the "${f.context}" step` : "";
  const note = f.note ? `\n  note: ${f.note}` : "";
  return `[${f.status}] ${f.id} from ${f.userName || "a guest"} (${when}${where})\n  ${f.text.replace(/\n/g, "\n  ")}${note}`;
}

const list = (status?: string) => call<Feedback[]>(`/feedback${status ? `?status=${status}` : ""}`);

switch (command) {
  case "list": {
    const items = await list(opts.status);
    console.log(items.length ? items.map(show).join("\n\n") : "No feedback.");
    break;
  }
  case "watch": {
    // One block per item the first time it's seen as todo, oldest first, so a monitor gets one event each.
    const seen = new Set<string>();
    const everyMs = Number(opts.every) * 1000;
    for (;;) {
      try {
        const todo = (await list("todo")).reverse();
        for (const f of todo) {
          if (seen.has(f.id)) continue;
          seen.add(f.id);
          console.log(`New feedback to do:\n${show(f)}\n`);
        }
      } catch (e) {
        console.error(`feedback watch: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, everyMs));
    }
  }
  case "start":
  case "done":
  case "wont": {
    if (!id) throw new Error(`Usage: feedback ${command} <id>${command === "start" ? "" : ' --note "..."'}`);
    const f =
      command === "start" ? await call<Feedback>(`/feedback/${id}/start`, {}) : await call<Feedback>(`/feedback/${id}/finish`, { outcome: command, note: opts.note });
    console.log(show(f));
    break;
  }
  default:
    console.log("Usage: npm run feedback -- watch | list [--status todo] | start <id> | done <id> --note ... | wont <id> --note ...");
    process.exitCode = command ? 1 : 0;
}
