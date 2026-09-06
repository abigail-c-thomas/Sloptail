import { Hono } from "hono";
import { cors } from "hono/cors";
import { validator } from "hono/validator";
import { z } from "zod";
import {
  CATALOG,
  ClaimBody,
  EditBody,
  OutOfBody,
  ProposeBody,
  SubmitBody,
} from "@sloptail/shared";
import { OpenRouterClient, ProposeError, edit, propose } from "@sloptail/llm";
import type { Env } from "./env.ts";
import type { Result } from "./bar-do.ts";

export { BarDO } from "./bar-do.ts";

type App = { Bindings: Env };

const app = new Hono<App>().basePath("/api");

app.use("*", cors());

// --- helpers ---------------------------------------------------------------

function bar(env: Env) {
  return env.BAR.get(env.BAR.idFromName("main"));
}

function llm(env: Env) {
  return new OpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL ?? "anthropic/claude-opus-5",
    fallbackModels: env.OPENROUTER_FALLBACK_MODELS?.split(",").map((s) => s.trim()).filter(Boolean),
    appName: "sloptail",
  });
}

/** Parse the JSON body with a zod schema; 400 with details on failure. */
function body<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return c.json({ error: "bad request", details: z.prettifyError(parsed.error) }, 400);
    return parsed.data as z.infer<T>;
  });
}

function unwrap<T>(c: { json: (o: unknown, status?: 404 | 409 | 200) => Response }, r: Result<T>): Response {
  if (r.ok) return c.json(r.value);
  const status = r.code === "not-found" ? 404 : 409;
  return c.json({ error: r.message, code: r.code }, status);
}

// --- public --------------------------------------------------------------

app.get("/health", (c) => c.json({ ok: true }));

app.get("/catalog", async (c) => {
  const unavailable = await bar(c.env).getUnavailable();
  return c.json({ catalog: CATALOG, unavailable });
});

app.post("/propose", body(ProposeBody), async (c) => {
  const { userName, request } = c.req.valid("json");
  const b = bar(c.env);
  const [unavailable, recentNames] = await Promise.all([b.getUnavailable(), b.getRecentNames()]);
  try {
    const result = await propose(
      { userName, request, unavailable: new Set(unavailable), recentNames },
      llm(c.env),
    );
    return c.json({ proposal: result.proposal, attempts: result.attempts.length });
  } catch (e) {
    return llmFailure(c, e);
  }
});

app.post("/edit", body(EditBody), async (c) => {
  const { request, proposal, tweak } = c.req.valid("json");
  const b = bar(c.env);
  const unavailable = await b.getUnavailable();
  try {
    const result = await edit(
      { userName: "guest", request, unavailable: new Set(unavailable) },
      proposal,
      tweak,
      llm(c.env),
    );
    return c.json({ proposal: result.proposal, attempts: result.attempts.length });
  } catch (e) {
    return llmFailure(c, e);
  }
});

app.post("/orders", body(SubmitBody), async (c) => {
  const input = c.req.valid("json");
  return unwrap(c, await bar(c.env).submit(input));
});

app.get("/orders/:id", async (c) => {
  const order = await bar(c.env).getOrder(c.req.param("id"));
  return order ? c.json(order) : c.json({ error: "not found" }, 404);
});

app.get("/users/:userId/orders", async (c) => {
  return c.json(await bar(c.env).getOrdersForUser(c.req.param("userId")));
});

// --- bar (token-protected) -------------------------------------------------

const barApi = new Hono<App>();

barApi.use("*", async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : c.req.query("token");
  if (!c.env.BAR_TOKEN || token !== c.env.BAR_TOKEN) return c.json({ error: "unauthorised" }, 401);
  await next();
});

barApi.get("/", async (c) => c.json(await bar(c.env).getBarView()));

barApi.post("/orders/:id/claim", body(ClaimBody), async (c) =>
  unwrap(c, await bar(c.env).claim(c.req.param("id"), c.req.valid("json").bartender)),
);
barApi.post("/orders/:id/unclaim", async (c) => unwrap(c, await bar(c.env).unclaim(c.req.param("id"))));
barApi.post("/orders/:id/ready", async (c) => unwrap(c, await bar(c.env).ready(c.req.param("id"))));
barApi.post("/orders/:id/collected", async (c) => unwrap(c, await bar(c.env).collected(c.req.param("id"))));
barApi.post("/orders/:id/cancel", body(z.object({ reason: z.string().max(200).default("cancelled by bar") })), async (c) =>
  unwrap(c, await bar(c.env).cancel(c.req.param("id"), c.req.valid("json").reason)),
);

barApi.post("/availability", body(OutOfBody), async (c) => {
  const { ingredient, available } = c.req.valid("json");
  if (!CATALOG.some((i) => i.id === ingredient)) return c.json({ error: "unknown ingredient" }, 400);
  const b = bar(c.env);
  const r = await b.setIngredientAvailable(ingredient, available);
  if (!r.ok) return unwrap(c, r);
  const affected = available ? [] : await b.getOrdersUsing(ingredient);
  return c.json({ unavailable: r.value, affected });
});

barApi.post("/reset", async (c) => {
  await bar(c.env).reset();
  return c.json({ ok: true });
});

app.route("/bar", barApi);

// --- errors ----------------------------------------------------------------

function llmFailure(c: { json: (o: unknown, status: 502 | 504) => Response }, e: unknown): Response {
  if (e instanceof ProposeError) {
    return c.json({ error: "The bartender-bot got confused. Try rephrasing, or pick a classic.", attempts: e.attempts.length }, 502);
  }
  const msg = (e as Error)?.message ?? String(e);
  const timeout = /abort|timeout/i.test(msg);
  return c.json({ error: timeout ? "The bartender-bot is thinking too slowly. Try again." : "The bartender-bot is unreachable. Pick a classic for now." }, timeout ? 504 : 502);
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;
