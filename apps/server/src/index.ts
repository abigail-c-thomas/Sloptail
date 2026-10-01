import { Hono } from "hono";
import { cors } from "hono/cors";
import { validator } from "hono/validator";
import { z } from "zod";
import {
  ClaimBody,
  CollectBody,
  DescribeBody,
  EditBody,
  makeCatalog,
  OutOfBody,
  PrinterReport,
  Profile,
  ProfileName,
  ProposeBody,
  StartBody,
  SubmitBody,
} from "@sloptail/shared";
import { OpenRouterClient, ProposeError, describeIngredients, edit, propose } from "@sloptail/llm";
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
    model: env.OPENROUTER_MODEL ?? "openai/gpt-5.6-luna",
    fallbackModels: env.OPENROUTER_FALLBACK_MODELS?.split(",").map((s) => s.trim()).filter(Boolean),
    appName: "sloptail",
    reasoning: env.OPENROUTER_REASONING as "none" | "low" | "medium" | "high" | undefined,
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

app.get("/catalog", async (c) => c.json(await bar(c.env).getCatalog()));

const TOO_MANY = "Easy there. The bartender-bot needs a minute; try again shortly.";

app.post("/propose", body(ProposeBody), async (c) => {
  const { userId, userName, request, seen = [] } = c.req.valid("json");
  const b = bar(c.env);
  if (!(await b.allowLlmCall(userId))) return c.json({ error: TOO_MANY }, 429);
  const inputs = await b.getPromptInputs(userId);
  // What they've been shown this visit, then what they've ordered before; one entry per drink.
  const history = [...seen, ...inputs.history].filter((p, i, all) => all.findIndex((q) => q.name === p.name) === i).slice(0, 8);
  try {
    const result = await propose(
      {
        catalog: makeCatalog(inputs.catalog),
        userName,
        request,
        unavailable: new Set(inputs.unavailable),
        recentNames: inputs.recentNames,
        history,
      },
      llm(c.env),
    );
    return c.json({ proposal: result.proposal, attempts: result.attempts.length });
  } catch (e) {
    return llmFailure(c, e);
  }
});

app.post("/edit", body(EditBody), async (c) => {
  const { userId, request, proposal, tweak } = c.req.valid("json");
  const b = bar(c.env);
  if (!(await b.allowLlmCall(userId))) return c.json({ error: TOO_MANY }, 429);
  const inputs = await b.getPromptInputs(userId);
  try {
    const result = await edit(
      { catalog: makeCatalog(inputs.catalog), userName: "guest", request, unavailable: new Set(inputs.unavailable) },
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

app.post("/orders/:id/collected", body(CollectBody), async (c) =>
  unwrap(c, await bar(c.env).collectedByGuest(c.req.param("id"), c.req.valid("json").userId)),
);

/** For the screen in the room: who's being made and who's ready. Public; names only. */
app.get("/board", async (c) => c.json(await bar(c.env).getBoard()));

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
barApi.post("/orders/:id/cancel", body(z.object({ reason: z.string().max(200).default("cancelled by bar") })), async (c) =>
  unwrap(c, await bar(c.env).cancel(c.req.param("id"), c.req.valid("json").reason)),
);

// --- printing: the print bridge (apps/print-bridge) polls these --------------

barApi.get("/print-queue", async (c) => c.json(await bar(c.env).getPrintQueue()));
barApi.post("/orders/:id/printed", async (c) => unwrap(c, await bar(c.env).printed(c.req.param("id"))));
barApi.post("/orders/:id/reprint", async (c) => unwrap(c, await bar(c.env).reprint(c.req.param("id"))));
barApi.post("/printer", body(PrinterReport), async (c) => {
  await bar(c.env).reportPrinter(c.req.valid("json"));
  return c.json({ ok: true });
});

barApi.post("/availability", body(OutOfBody), async (c) => {
  const { ingredient, available } = c.req.valid("json");
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

// --- admin (token-protected): event setup -----------------------------------

const adminApi = new Hono<App>();

adminApi.use("*", async (c, next) => {
  const expected = c.env.ADMIN_TOKEN || c.env.BAR_TOKEN;
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || token !== expected) return c.json({ error: "unauthorised" }, 401);
  await next();
});

adminApi.get("/", async (c) => c.json(await bar(c.env).getAdminView()));

adminApi.put("/profiles/:name", body(Profile), async (c) => {
  const name = ProfileName.safeParse(c.req.param("name"));
  if (!name.success) return c.json({ error: "unknown profile" }, 404);
  return c.json(await bar(c.env).saveProfile(name.data, c.req.valid("json")));
});

/** Typed-in names -> catalog entries for the admin to review. Doesn't save anything; names the model couldn't do come back in `failed`. */
adminApi.post("/describe", body(DescribeBody), async (c) => c.json(await describeIngredients(c.req.valid("json").names, llm(c.env))));

adminApi.post("/start", body(StartBody), async (c) => c.json(await bar(c.env).start(c.req.valid("json").profile)));

app.route("/admin", adminApi);

// --- errors ----------------------------------------------------------------

function llmFailure(c: { json: (o: unknown, status: 502 | 504) => Response }, e: unknown): Response {
  console.error("llm failure", (e as Error)?.name, (e as Error)?.message, e instanceof ProposeError ? e.attempts.map((a) => a.problems) : "");
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
