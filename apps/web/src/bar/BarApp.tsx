import { useCallback, useEffect, useMemo, useState } from "react";
import { CATALOG, type Order } from "@sloptail/shared";
import { Badge, Banner, Button, Card, Drawer, RecipeList, Stack, TextField } from "@sloptail/ui";
import { BarApiError, makeBarApi, type BarView } from "./barApi.ts";

const POLL_MS = 2000;
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Bar screen. Assumed device: a laptop or tablet in a browser, landscape.
 * Three columns: what to make next (batched), what's being made, what's on
 * the bar waiting to be collected. Ingredient availability lives in a drawer.
 */
export function BarApp() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? localStorage.getItem("sloptail:barToken") ?? "");
  const [bartender, setBartender] = useState(() => localStorage.getItem("sloptail:bartender") ?? "");
  const [view, setView] = useState<BarView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [now, setNow] = useState(Date.now());

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

  /** Optimistic-ish: run the mutation, then refresh immediately. */
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
  };

  if (!token || (error && !view)) {
    return (
      <div className="page">
        <h1>Bar</h1>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <TextField id="token" label="Bar token" value={token} onChange={(e) => setToken(e.target.value)} help="Set as BAR_TOKEN on the server, or open /bar?token=…" />
        <Button onClick={refresh}>Connect</Button>
      </div>
    );
  }

  const making = view?.queue.filter((o) => o.status === "making") ?? [];
  const s = view?.stats;

  return (
    <div className="bar">
      <header className="bar-header">
        <div className="row" style={{ gap: 12 }}>
          <span className="brand">Sloptail bar</span>
          {s ? (
            <div className="bar-stats">
              <span><b>{s.queued}</b> queued</span>
              <span><b>{s.making}</b> making</span>
              <span><b>{s.ready}</b> on bar</span>
              <span><b>{s.collected}</b> served</span>
              {s.avgWaitSeconds !== null ? <span>avg wait <b>{Math.round(s.avgWaitSeconds / 60)}m</b></span> : null}
            </div>
          ) : null}
        </div>
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
            Ingredients{view?.unavailable.length ? ` (${view.unavailable.length} out)` : ""}
          </Button>
        </div>
      </header>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div className="bar-columns">
        <section className="bar-col">
          <h2>
            Up next <span className="count">{view?.stats.queued ?? 0}</span>
          </h2>
          {view?.batches.length === 0 ? <div className="empty">Nothing queued. Have a drink yourself.</div> : null}
          {view?.batches.map((b) => (
            <div key={b.key} className="batch">
              <div className="batch-label">
                <span>{b.label}</span>
                {b.orders.length > 1 ? <span>×{b.orders.length} · make together</span> : null}
              </div>
              {b.orders.map((o) => (
                <OrderCard key={o.id} order={o} now={now}>
                  <Button size="sm" onClick={() => act(() => api.claim(o.id, bartender || "bar"))}>
                    Make
                  </Button>
                  <Button size="sm" variant="ok" onClick={() => act(() => api.ready(o.id))}>
                    Done
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => confirm(`Cancel ${o.userName}'s ${o.proposal.name}?`) && act(() => api.cancel(o.id, "the bar couldn't make it"))}>
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
          {making.length === 0 ? <div className="empty">Nobody's shaking anything.</div> : null}
          {making.map((o) => (
            <OrderCard key={o.id} order={o} now={now}>
              <Button size="sm" variant="ok" onClick={() => act(() => api.ready(o.id))}>
                Ready, shout it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(() => api.unclaim(o.id))}>
                Back to queue
              </Button>
            </OrderCard>
          ))}
        </section>

        <section className="bar-col">
          <h2>
            On the bar <span className="count">{view?.ready.length ?? 0}</span>
          </h2>
          {view?.ready.length === 0 ? <div className="empty">Nothing waiting.</div> : null}
          {view?.ready.map((o) => (
            <Card key={o.id} className="order-card ready stack" style={{ gap: 6 }}>
              <div className="ready-name">{o.userName}</div>
              <div className="what">{o.proposal.name}</div>
              <div className="row">
                <Button size="sm" variant="secondary" onClick={() => act(() => api.collected(o.id))}>
                  Collected
                </Button>
                <span className="age">{age(o.readyAt ?? o.createdAt, now)} waiting</span>
              </div>
            </Card>
          ))}
          {view?.recent.length ? (
            <details>
              <summary className="muted small">Recently served</summary>
              <ul className="small muted">
                {view.recent.map((o) => (
                  <li key={o.id}>
                    {o.userName}: {o.proposal.name} {o.status === "cancelled" ? "(cancelled)" : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Ingredients">
        <p className="small muted">Tap anything you've run out of. The model stops using it and new orders can't include it.</p>
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
                          alert(`${r.affected.length} live order(s) use ${i.name}: ${r.affected.map((o) => o.userName).join(", ")}. They're still queued; cancel them if needed.`);
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
        <span className="age">{age(order.createdAt, now)}</span>
      </div>
      <div className="row between">
        <span className="what">
          {order.proposal.name} · {order.proposal.glass}
        </span>
        {order.claimedBy ? <Badge tone="accent">{order.claimedBy}</Badge> : null}
      </div>
      <RecipeList recipe={order.proposal.recipe} compact />
      <div className="row">{children}</div>
    </Card>
  );
}

function age(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}`;
}
