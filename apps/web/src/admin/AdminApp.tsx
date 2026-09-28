import { useCallback, useEffect, useMemo, useState } from "react";
import { slugify, TYPE_LABEL, type Ingredient, type Profile, type ProfileName } from "@sloptail/shared";
import { Badge, Banner, Button, Card, Choice, Stack, TextArea, TextField } from "@sloptail/ui";
import { ApiError } from "../api.ts";
import { makeAdminApi, type AdminView } from "./adminApi.ts";

const TOKEN_KEY = "sloptail:adminToken";
const TYPES = ["base", "mixer", "flavoring", "garnish"] as const;
const UNITS = ["part", "dash", "drop", "barspoon", "pump", "piece"] as const;
const LABEL: Record<ProfileName, string> = { practice: "Practice", real: "Real" };

/**
 * Event setup, before the doors open: what's behind the bar for the practice
 * run and for the real thing, how much of each, and where the receipt printer
 * is. Starting a profile makes it live and clears every order.
 */
export function AdminApp() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? localStorage.getItem(TOKEN_KEY) ?? "");
  const [view, setView] = useState<AdminView | null>(null);
  const [drafts, setDrafts] = useState<Record<ProfileName, Profile> | null>(null);
  const [tab, setTab] = useState<ProfileName>("real");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
  const other: ProfileName = tab === "real" ? "practice" : "real";

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
        options={(["practice", "real"] as const).map((p) => ({
          value: p,
          label: LABEL[p],
          hint: view.config.active === p ? "running" : `${drafts[p].ingredients.length} ingredients`,
        }))}
      />

      <Card className="stack">
        <div className="row between">
          <h2>{live ? `${LABEL[tab]} is running` : `Start ${LABEL[tab].toLowerCase()}`}</h2>
          <Button
            variant={live ? "secondary" : "primary"}
            loading={busy === "start"}
            disabled={dirty}
            onClick={() =>
              confirm(`${live ? "Restart" : "Start"} ${LABEL[tab].toLowerCase()}? This clears all ${orders} orders and out-of-stock marks.`) &&
              run("start", async () => accept(await api.start(tab), false))
            }
          >
            {live ? "Restart" : `Start ${LABEL[tab].toLowerCase()}`}
          </Button>
        </div>
        {dirty ? <p className="small muted">Save first.</p> : null}
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              confirm(`Replace ${LABEL[tab]}'s list with ${LABEL[other]}'s?`) &&
              setDraft({ ...draft, ingredients: structuredClone(drafts[other].ingredients) })
            }
          >
            Copy from {LABEL[other]}
          </Button>
        </div>
        <AddIngredients
          busy={busy === "describe"}
          onAdd={(names) =>
            run("describe", async () => {
              const have = new Set(draft.ingredients.map((i) => i.id));
              const fresh = names.filter((n) => !have.has(slugify(n)));
              if (!fresh.length) return;
              const r = await api.describe(fresh);
              // Whatever the model couldn't fill in still gets a row, to finish by hand.
              const added: Ingredient[] = [];
              for (const i of [...r.ingredients, ...r.failed.map(blankIngredient)]) {
                if (have.has(i.id)) continue;
                have.add(i.id);
                added.push(i);
              }
              setDraft({ ...draft, ingredients: [...draft.ingredients, ...added] });
              if (r.failed.length) setError(`Fill these in by hand: ${r.failed.join(", ")}`);
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

function blankIngredient(name: string): Ingredient {
  return { id: slugify(name), name: name.trim(), type: "flavoring", flavor: [], alcoholic: false, unit: "part" };
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

/** "700", "2x700", "2*750" -> ml. Empty -> undefined. */
function parseStock(text: string): number | undefined {
  const t = text.replace(/\s|ml/gi, "");
  if (!t) return undefined;
  const m = /^(\d+(?:\.\d+)?)(?:[x*×](\d+(?:\.\d+)?))?$/i.exec(t);
  if (!m) return undefined;
  return m[2] ? Number(m[1]) * Number(m[2]) : Number(m[1]);
}

function num(text: string): number | undefined {
  return text.trim() === "" || Number.isNaN(Number(text)) ? undefined : Number(text);
}

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
            <th>Name</th>
            <th>Type</th>
            <th>Unit</th>
            <th title="Alcohol by volume, %">ABV</th>
            <th title="Grams of sugar per 100ml">Sugar</th>
            <th title="Grams of acid per 100ml">Acid</th>
            <th title="Most per drink, in its unit">Max</th>
            <th title="ml (e.g. 2x700), or pieces for garnishes">Stock</th>
            <th>Flavours</th>
            <th>Notes</th>
            <th />
          </tr>
        </thead>
        {TYPES.map((type) => {
          const rows = ingredients.filter((i) => i.type === type);
          if (!rows.length) return null;
          return (
            <tbody key={type}>
              <tr className="admin-group">
                <td colSpan={11}>{TYPE_LABEL[type]}</td>
              </tr>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <input className="input" value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} aria-label="Name" />
                  </td>
                  <td>
                    <select className="input" value={i.type} onChange={(e) => update(i.id, { type: e.target.value as Ingredient["type"] })} aria-label="Type">
                      {TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="input" value={i.unit} onChange={(e) => update(i.id, { unit: e.target.value as Ingredient["unit"] })} aria-label="Unit">
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <NumCell value={i.abv} label="ABV" onChange={(abv) => update(i.id, { abv, alcoholic: (abv ?? 0) > 0 })} />
                  <NumCell value={i.sugar} label="Sugar" onChange={(sugar) => update(i.id, { sugar })} />
                  <NumCell value={i.acid} label="Acid" onChange={(acid) => update(i.id, { acid })} />
                  <NumCell value={i.max} label="Max" onChange={(max) => update(i.id, { max: max || undefined })} />
                  <td className="admin-stock">
                    <StockInput value={i.stock} onChange={(stock) => update(i.id, { stock })} />
                    {used && i.stock !== undefined ? (
                      <Badge tone={used.get(i.id)! >= i.stock ? "danger" : used.get(i.id)! > i.stock * 0.8 ? "warn" : undefined}>
                        {Math.max(0, Math.round(i.stock - (used.get(i.id) ?? 0)))}
                        {i.unit === "piece" ? "" : "ml"} left
                      </Badge>
                    ) : null}
                  </td>
                  <td>
                    <TextInput
                      value={i.flavor.join(", ")}
                      label="Flavours"
                      onCommit={(t) => update(i.id, { flavor: t.split(",").map((f) => f.trim()).filter(Boolean) })}
                    />
                  </td>
                  <td>
                    <TextInput value={i.notes ?? ""} label="Notes" onCommit={(t) => update(i.id, { notes: t.trim() || undefined })} />
                  </td>
                  <td>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)}>
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function NumCell({ value, label, onChange }: { value: number | undefined; label: string; onChange: (n: number | undefined) => void }) {
  return (
    <td>
      <TextInput value={value === undefined ? "" : String(value)} label={label} numeric onCommit={(t) => onChange(num(t))} />
    </td>
  );
}

function StockInput({ value, onChange }: { value: number | undefined; onChange: (n: number | undefined) => void }) {
  return <TextInput value={value === undefined ? "" : String(value)} label="Stock" onCommit={(t) => onChange(parseStock(t))} />;
}

/** Edits locally, commits on blur or Enter, so "2x7" isn't parsed halfway through typing "2x700". */
function TextInput({ value, label, numeric, onCommit }: { value: string; label: string; numeric?: boolean; onCommit: (t: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className="input"
      aria-label={label}
      inputMode={numeric ? "decimal" : undefined}
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
