import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultContainer, slugify, TYPE_LABEL, type Ingredient, type Profile, type ProfileName } from "@sloptail/shared";
import { Badge, Banner, Button, Card, Choice, Stack, TextArea, TextField } from "@sloptail/ui";
import { ApiError } from "../api.ts";
import { makeAdminApi, type AdminView } from "./adminApi.ts";

const TOKEN_KEY = "sloptail:adminToken";
const TYPES = ["base", "mixer", "flavoring", "garnish"] as const;
const PROFILES = ["dev", "practice", "real"] as const;
const LABEL: Record<ProfileName, string> = { dev: "Dev", practice: "Practice", real: "Real" };

/**
 * Event setup, before the doors open: what's behind the bar for dev, the
 * practice run and the real thing, how much of each, and where the receipt printer
 * is. Starting a profile makes it live and clears every order.
 */
export function AdminApp() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? localStorage.getItem(TOKEN_KEY) ?? "");
  const [view, setView] = useState<AdminView | null>(null);
  const [drafts, setDrafts] = useState<Record<ProfileName, Profile> | null>(null);
  const [tab, setTab] = useState<ProfileName>("real");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Asked "really switch/restart?" and waiting for the answer. In-page, not confirm(): some browsers block dialogs. */
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [tab]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) {
      localStorage.setItem(TOKEN_KEY, fromUrl);
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  const api = useMemo(() => makeAdminApi(token), [token]);

  /** Take a fresh view from the server. Drafts are replaced only when asked (load, save, start). */
  const accept = (v: AdminView, resetDrafts: boolean) => {
    setView(v);
    if (resetDrafts) setDrafts(structuredClone(v.config.profiles));
  };

  const load = useCallback(async () => {
    try {
      const v = await api.view();
      accept(v, true);
      setTab(v.config.active);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Wrong admin token." : (e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      setError(null);
    } catch (e) {
      const details = e instanceof ApiError ? (e.body as { details?: string } | null)?.details : undefined;
      setError(details ? `${(e as Error).message}: ${details}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!view || !drafts) {
    return (
      <div className="page">
        <h1>Admin</h1>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <TextField id="token" label="Admin token" value={token} onChange={(e) => setToken(e.target.value)} />
        <Button onClick={() => (localStorage.setItem(TOKEN_KEY, token), void load())}>Connect</Button>
      </div>
    );
  }

  const draft = drafts[tab];
  const dirty = canonical(draft) !== canonical(view.config.profiles[tab]);
  const live = view.config.active === tab;
  const { queued, making, ready, collected, cancelled } = view.stats;
  const orders = queued + making + ready + collected + cancelled;
  const setDraft = (p: Profile) => setDrafts({ ...drafts, [tab]: p });

  return (
    <div className="admin">
      <header className="page-header">
        <span className="brand">Sloptail admin</span>
        <span className="muted small">
          Running <b>{LABEL[view.config.active]}</b> · {orders} order{orders === 1 ? "" : "s"}
        </span>
      </header>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Choice<ProfileName>
        inline
        name="Profile"
        value={tab}
        onChange={setTab}
        options={PROFILES.map((p) => ({
          value: p,
          label: LABEL[p],
          hint: view.config.active === p ? "running" : `${drafts[p].ingredients.length} ingredients`,
        }))}
      />

      <Card className="stack">
        <div className="row between">
          <h2>{live ? `${LABEL[tab]} is running` : `${LABEL[view.config.active]} is running`}</h2>
          {confirming ? null : (
            <Button variant={live ? "secondary" : "primary"} disabled={dirty || !draft.ingredients.length} onClick={() => setConfirming(true)}>
              {live ? "Restart" : `Switch to ${LABEL[tab].toLowerCase()}`}
            </Button>
          )}
        </div>
        {confirming ? (
          <Stack gap={10}>
            <Banner tone="warn">
              {live ? `Restart ${LABEL[tab].toLowerCase()}?` : `Stop ${LABEL[view.config.active].toLowerCase()} and switch to ${LABEL[tab].toLowerCase()}?`} This clears{" "}
              {orders} order{orders === 1 ? "" : "s"} and every out-of-stock mark.
            </Banner>
            <div className="row">
              <Button
                loading={busy === "start"}
                onClick={() =>
                  run("start", async () => {
                    accept(await api.start(tab), false);
                    setConfirming(false);
                  })
                }
              >
                {live ? "Yes, restart" : `Yes, switch to ${LABEL[tab].toLowerCase()}`}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </Stack>
        ) : dirty ? (
          <p className="small muted">Save first.</p>
        ) : !draft.ingredients.length ? (
          <p className="small muted">Add ingredients first.</p>
        ) : !live ? (
          <p className="small muted">
            Only one profile runs at a time. Switching stops {LABEL[view.config.active].toLowerCase()} and clears its {orders} order{orders === 1 ? "" : "s"}.
          </p>
        ) : null}
      </Card>

      <Card className="stack">
        <TextField
          id="printer"
          label="Receipt printer"
          placeholder="192.168.1.50:9100"
          value={draft.printerIp}
          onChange={(e) => setDraft({ ...draft, printerIp: e.target.value.trim() })}
        />
      </Card>

      <Card className="stack">
        <div className="row between">
          <h2>Ingredients ({draft.ingredients.length})</h2>
          <span className="row">
            {PROFILES.filter((p) => p !== tab).map((other) => (
              <Button
                key={other}
                size="sm"
                variant="ghost"
                disabled={!drafts[other].ingredients.length}
                onClick={() =>
                  // Only the draft changes; Discard undoes it.
                  setDraft({ ...draft, ingredients: structuredClone(drafts[other].ingredients) })
                }
              >
                Copy from {LABEL[other]}
              </Button>
            ))}
          </span>
        </div>
        <AddIngredients
          busy={busy === "describe"}
          onAdd={(names) =>
            run("describe", async () => {
              const have = new Set(draft.ingredients.map((i) => i.id));
              const fresh = names.filter((n) => !have.has(slugify(n)));
              if (!fresh.length) return;
              // Already described for another profile: reuse it (minus that profile's stock) instead of asking again.
              const elsewhere = new Map(PROFILES.flatMap((p) => drafts[p].ingredients.map((i) => [i.id, i] as const)));
              const reused = fresh.flatMap((n) => {
                const hit = elsewhere.get(slugify(n));
                if (!hit) return [];
                const { stock: _stock, ...copy } = structuredClone(hit);
                return [copy];
              });
              const rest = fresh.filter((n) => !elsewhere.has(slugify(n)));
              const r = rest.length ? await api.describe(rest) : { ingredients: [], failed: [] };
              const added: Ingredient[] = [];
              for (const i of [...reused, ...r.ingredients]) {
                if (have.has(i.id)) continue;
                have.add(i.id);
                added.push(i);
              }
              setDraft({ ...draft, ingredients: [...draft.ingredients, ...added] });
              // Type, ABV, flavours etc. aren't editable here, so a name the model can't place isn't added at all.
              if (r.failed.length) setError(`Couldn't work out: ${r.failed.join(", ")}. Try another name.`);
            })
          }
        />
        <IngredientTable
          ingredients={draft.ingredients}
          used={live && !dirty ? new Map(view.stock.map((l) => [l.ingredient, l.used])) : undefined}
          onChange={(ingredients) => setDraft({ ...draft, ingredients })}
        />
      </Card>

      {dirty ? (
        <div className="admin-save">
          <Button variant="ghost" onClick={() => setDraft(structuredClone(view.config.profiles[tab]))}>
            Discard
          </Button>
          <Button
            loading={busy === "save"}
            onClick={() =>
              run("save", async () => {
                const v = await api.save(tab, draft);
                accept(v, false);
                setDrafts({ ...drafts, [tab]: structuredClone(v.config.profiles[tab]) });
              })
            }
          >
            Save {LABEL[tab].toLowerCase()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** JSON with sorted keys, so key order doesn't make a saved profile look edited. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );
}

function AddIngredients({ busy, onAdd }: { busy: boolean; onAdd: (names: string[]) => void }) {
  const [text, setText] = useState("");
  const names = text
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean);
  return (
    <Stack gap={8}>
      <TextArea
        id="add"
        aria-label="Add ingredients"
        placeholder="Add ingredients, one per line or comma-separated"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row">
        <Button
          size="sm"
          loading={busy}
          disabled={!names.length}
          onClick={() => {
            onAdd(names);
            setText("");
          }}
        >
          Add
        </Button>
      </div>
    </Stack>
  );
}

/** "2", "1.5", "" -> number or undefined. */
function num(text: string): number | undefined {
  const t = text.trim();
  return t === "" || Number.isNaN(Number(t)) ? undefined : Number(t);
}

/** Name and stock only: type, ABV, flavours and the rest come from the catalog or the model. */
function IngredientTable({
  ingredients,
  used,
  onChange,
}: {
  ingredients: Ingredient[];
  used: Map<string, number> | undefined;
  onChange: (list: Ingredient[]) => void;
}) {
  const update = (id: string, patch: Partial<Ingredient>) =>
    onChange(ingredients.map((i) => (i.id === id ? dropUndefined({ ...i, ...patch }) : i)));
  const remove = (id: string) => onChange(ingredients.filter((i) => i.id !== id));

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th />
            <th>Name</th>
            <th title="How many bottles (or pieces, for garnishes), and how big a bottle is">Stock</th>
          </tr>
        </thead>
        {TYPES.map((type) => {
          const rows = ingredients.filter((i) => i.type === type);
          if (!rows.length) return null;
          return (
            <tbody key={type}>
              <tr className="admin-group">
                <td colSpan={3}>{TYPE_LABEL[type]}</td>
              </tr>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="admin-remove">
                    <Button size="sm" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)}>
                      ✕
                    </Button>
                  </td>
                  <td>
                    <input className="input" value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} aria-label="Name" />
                  </td>
                  <StockCell ingredient={i} used={used?.get(i.id)} onChange={(patch) => update(i.id, patch)} />
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/**
 * Stock as "[2] × [700] ml" (or "[12] pieces"): a count of containers and the
 * container's size. Stored as total ml in `stock`, which is what the
 * running-out estimate uses; `container` is kept only when it isn't the default.
 */
function StockCell({
  ingredient: i,
  used,
  onChange,
}: {
  ingredient: Ingredient;
  used: number | undefined;
  onChange: (patch: Partial<Ingredient>) => void;
}) {
  const usual = defaultContainer(i);
  const size = i.container ?? usual;
  const count = i.stock === undefined ? undefined : i.stock / size;
  const left = used !== undefined && i.stock !== undefined ? Math.max(0, i.stock - used) / size : undefined;
  const shown = (n: number) => String(Math.round(n * 100) / 100);
  return (
    <td>
      <div className="admin-stock">
        <TextInput
          value={count === undefined ? "" : shown(count)}
          label="How many"
          onCommit={(t) => {
            const n = num(t);
            onChange({ stock: n === undefined ? undefined : n * size });
          }}
        />
        {i.unit === "piece" ? (
          <span className="muted">pieces</span>
        ) : (
          <>
            <span className="muted">×</span>
            <TextInput
              value={String(size)}
              label="Bottle size, ml"
              onCommit={(t) => {
                const ml = num(t);
                if (!ml || ml <= 0) return;
                onChange({ container: ml === usual ? undefined : ml, stock: count === undefined ? undefined : count * ml });
              }}
            />
            <span className="muted">ml</span>
          </>
        )}
        {left !== undefined ? (
          <Badge tone={left <= 0 ? "danger" : left < count! * 0.2 ? "warn" : undefined}>{shown(left)} left</Badge>
        ) : null}
      </div>
    </td>
  );
}

/** Edits locally, commits on blur or Enter, so "2x7" isn't parsed halfway through typing "2x700". */
function TextInput({ value, label, onCommit }: { value: string; label: string; onCommit: (t: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className="input"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Optional fields go missing rather than being sent as undefined/NaN. */
function dropUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
