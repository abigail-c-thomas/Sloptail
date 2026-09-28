import { useCallback, useEffect, useMemo, useState } from "react";
import { CATALOG, type Order } from "@sloptail/shared";
import { Badge, Banner, Button, Card, Drawer, RecipeList, Stack, TextField } from "@sloptail/ui";
import { BarApiError, makeBarApi, type BarView } from "./barApi.ts";

const POLL_MS = 2000;
const STALE_AFTER_MS = 5 * 60 * 1000;
const UNDO_MS = 8000;

/**
 * Bar screen. Two columns: what to make next (batched) and what's being made.
 * Once a drink is marked ready the bar is done with it; the guest taps "Got it"
 * on their phone and the room screen (/screen) shows who's waiting.
 */
export function BarApp() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? localStorage.getItem("sloptail:barToken") ?? "");
  const [bartender, setBartender] = useState(() => localStorage.getItem("sloptail:bartender") ?? "");
  const [view, setView] = useState<BarView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [now, setNow] = useState(Date.now());
  /** Last order marked ready, so a mis-tap can be taken back. */
  const [lastReady, setLastReady] = useState<{ order: Order; at: number } | null>(null);

  // Persist token from the URL, then remove it from the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) {
      localStorage.setItem("sloptail:barToken", fromUrl);
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);
  useEffect(() => localStorage.setItem("sloptail:bartender", bartender), [bartender]);

  const api = useMemo(() => makeBarApi(token), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setView(await api.view());
      setError(null);
    } catch (e) {
      setError(e instanceof BarApiError && e.status === 401 ? "Wrong or missing bar token." : (e as Error).message);
    }
  }, [api, token]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  /** Run the mutation, then refresh immediately. */
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
  };

  const ready = (o: Order) =>
    act(async () => {
      await api.ready(o.id);
      setLastReady({ order: o, at: Date.now() });
    });

  if (!token || (error && !view)) {
    return (
      <div className="page">
        <h1>Bar</h1>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <TextField id="token" label="Bar token" value={token} onChange={(e) => setToken(e.target.value)} />
        <Button onClick={refresh}>Connect</Button>
      </div>
    );
  }

  const making = view?.queue.filter((o) => o.status === "making") ?? [];
  const undo = lastReady && now - lastReady.at < UNDO_MS ? lastReady.order : null;

  return (
    <div className="bar">
      <header className="bar-header">
        <span className="brand">Sloptail</span>
        <div className="row">
          <input
            className="input"
            style={{ width: 140, minHeight: 36, padding: "6px 10px" }}
            placeholder="Your name"
            value={bartender}
            onChange={(e) => setBartender(e.target.value)}
            aria-label="Bartender name"
          />
          <Button variant="secondary" size="sm" onClick={() => setDrawer(true)}>
            Stock{view?.unavailable.length ? ` (${view.unavailable.length} out)` : ""}
          </Button>
        </div>
      </header>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {undo ? (
        <div className="undo row between">
          <span>
            <b>{undo.userName}</b> ready
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLastReady(null);
              void act(() => api.claim(undo.id, undo.claimedBy ?? (bartender || "bar")));
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      <div className="bar-columns">
        <section className="bar-col">
          <h2>
            Queue <span className="count">{view?.stats.queued ?? 0}</span>
          </h2>
          {view?.batches.map((b) => (
            <div key={b.key} className={b.orders.length > 1 ? "batch" : "stack"} style={{ gap: 8 }}>
              {b.orders.length > 1 ? <div className="batch-label">×{b.orders.length} {b.label}</div> : null}
              {b.orders.map((o) => (
                <OrderCard key={o.id} order={o} now={now}>
                  <Button size="sm" onClick={() => act(() => api.claim(o.id, bartender || "bar"))}>
                    Make
                  </Button>
                  <Button size="sm" variant="ok" onClick={() => ready(o)}>
                    Ready
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Cancel"
                    onClick={() => confirm(`Cancel ${o.userName}'s ${o.proposal.name}?`) && act(() => api.cancel(o.id, "the bar couldn't make it"))}
                  >
                    ✕
                  </Button>
                </OrderCard>
              ))}
            </div>
          ))}
        </section>

        <section className="bar-col">
          <h2>
            Making <span className="count">{making.length}</span>
          </h2>
          {making.map((o) => (
            <OrderCard key={o.id} order={o} now={now}>
              <Button size="sm" variant="ok" onClick={() => ready(o)}>
                Ready
              </Button>
              <Button size="sm" variant="ghost" aria-label="Back to queue" onClick={() => act(() => api.unclaim(o.id))}>
                ↩
              </Button>
            </OrderCard>
          ))}
        </section>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Stock">
        <p className="small muted">Tap to mark out.</p>
        {(["base", "mixer", "flavoring", "garnish"] as const).map((type) => (
          <Stack key={type} gap={6}>
            <h3 style={{ textTransform: "capitalize" }}>{type}s</h3>
            <div className="ingredients">
              {CATALOG.filter((i) => i.type === type).map((i) => {
                const out = view?.unavailable.includes(i.id) ?? false;
                return (
                  <Button
                    key={i.id}
                    size="sm"
                    variant={out ? "danger" : "secondary"}
                    className={`ingredient-toggle ${out ? "out" : ""}`}
                    onClick={() =>
                      act(async () => {
                        const r = await api.availability(i.id, out);
                        if (!out && r.affected.length) {
                          alert(`Still queued with ${i.name}: ${r.affected.map((o) => o.userName).join(", ")}`);
                        }
                      })
                    }
                  >
                    <span>{i.name}</span>
                    {out ? <Badge tone="danger">out</Badge> : null}
                  </Button>
                );
              })}
            </div>
          </Stack>
        ))}
        <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />
        <Button
          variant="danger"
          size="sm"
          onClick={() => confirm("Wipe every order? This is for rehearsals only.") && act(() => api.reset())}
        >
          Reset everything
        </Button>
      </Drawer>
    </div>
  );
}

function OrderCard({ order, now, children }: { order: Order; now: number; children: React.ReactNode }) {
  const stale = now - order.createdAt > STALE_AFTER_MS && order.status === "queued";
  return (
    <Card className={`order-card stack ${stale ? "stale" : ""}`} style={{ gap: 6 }}>
      <div className="row between">
        <span className="who">{order.userName}</span>
        <span className="row" style={{ gap: 6 }}>
          {order.claimedBy ? <Badge tone="accent">{order.claimedBy}</Badge> : null}
          <span className="age">{age(order.createdAt, now)}</span>
        </span>
      </div>
      <div className="glass">{order.proposal.glass}</div>
      <RecipeList recipe={order.proposal.recipe} compact />
      <div className="row">{children}</div>
    </Card>
  );
}

function age(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}`;
}
