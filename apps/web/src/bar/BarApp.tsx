import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CATALOG, makeCatalog, TYPE_LABEL, type Order } from "@sloptail/shared";
import { Badge, Banner, Button, Card, CatalogProvider, Drawer, RecipeList, Stack, TextField } from "@sloptail/ui";
import { BarApiError, makeBarApi, type BarView } from "./barApi.ts";

const POLL_MS = 2000;
const STALE_AFTER_MS = 5 * 60 * 1000;
const UNDO_MS = 8000;
/** The print bridge reports every couple of seconds; this long without one means it's gone. */
const PRINTER_SILENT_MS = 20 * 1000;

/**
 * Bar screen. Two columns: what to make next (batched) and what's being made.
 * Once a drink is marked ready the bar is done with it; the guest taps "Got it"
 * on their phone and the room screen (/screen) shows who's waiting.
 */
export function BarApp() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? localStorage.getItem("sloptail:barToken") ?? "");
  const [view, setView] = useState<BarView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [now, setNow] = useState(Date.now());
  /** Last order marked ready, so a mis-tap can be taken back. */
  const [lastReady, setLastReady] = useState<{ order: Order; at: number } | null>(null);
  /** Order whose ✕ was tapped, waiting for "yes, cancel". In-page, not confirm(): some browsers block dialogs. */
  const [cancelling, setCancelling] = useState<string | null>(null);
  /** After marking something out: who's still queued with it. */
  const [stockNote, setStockNote] = useState<string | null>(null);

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
  const catalog = view ? makeCatalog(view.catalog) : DEFAULT_CATALOG;
  const left = new Map(view?.stock.map((l) => [l.ingredient, Math.max(0, 1 - l.used / (l.stock || 1))]));
  const undo = lastReady && now - lastReady.at < UNDO_MS ? lastReady.order : null;

  return (
    <CatalogProvider value={catalog}>
      <div className="bar">
        <header className="bar-header">
          <span className="brand">Sloptail{view && view.profile !== "real" ? <Badge tone="warn">{view.profile}</Badge> : null}</span>
          <div className="row">
            <PrinterBadge printer={view?.printer ?? null} now={now} />
            <Button variant="secondary" size="sm" onClick={() => setDrawer(true)}>
              Stock{view?.unavailable.length ? ` (${view.unavailable.length} out)` : ""}
            </Button>
          </div>
        </header>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {view?.printer && !view.printer.ok && now - view.printer.at < PRINTER_SILENT_MS ? (
          <Banner tone="danger">{view.printer.message}</Banner>
        ) : null}
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
                void act(() => api.claim(undo.id));
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
                    {cancelling === o.id ? (
                      <>
                        <span className="small">Cancel {o.proposal.name}?</span>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setCancelling(null);
                            void act(() => api.cancel(o.id, "the bar couldn't make it"));
                          }}
                        >
                          Yes, cancel
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setCancelling(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => act(() => api.claim(o.id))}>
                          Start
                        </Button>
                        <ReprintButton order={o} onReprint={() => act(() => api.reprint(o.id))} />
                        <Button size="sm" variant="ghost" aria-label="Cancel" onClick={() => setCancelling(o.id)}>
                          ✕
                        </Button>
                      </>
                    )}
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
                <ReprintButton order={o} onReprint={() => act(() => api.reprint(o.id))} />
              </OrderCard>
            ))}
          </section>
        </div>

        <Drawer
          open={drawer}
          onClose={() => {
            setDrawer(false);
            setStockNote(null);
          }}
          title="Stock"
        >
          <p className="small muted">Tap to mark out. % is a rough estimate of what's left.</p>
          {stockNote ? <Banner tone="warn">{stockNote}</Banner> : null}
          {(["base", "mixer", "flavoring", "garnish"] as const).map((type) => (
            <Stack key={type} gap={6}>
              <h3>{TYPE_LABEL[type]}</h3>
              <div className="ingredients">
                {catalog.list.filter((i) => i.type === type).map((i) => {
                  const out = view?.unavailable.includes(i.id) ?? false;
                  const frac = left.get(i.id);
                  return (
                    <Button
                      key={i.id}
                      size="sm"
                      variant={out ? "danger" : "secondary"}
                      className={`ingredient-toggle ${out ? "out" : ""}`}
                      onClick={() =>
                        act(async () => {
                          const r = await api.availability(i.id, out);
                          setStockNote(!out && r.affected.length ? `Still queued with ${i.name}: ${r.affected.map((o) => o.userName).join(", ")}` : null);
                        })
                      }
                    >
                      <span>{i.name}</span>
                      {out ? (
                        <Badge tone="danger">out</Badge>
                      ) : frac !== undefined ? (
                        <Badge tone={frac <= 0 ? "danger" : frac < 0.2 ? "warn" : undefined}>~{Math.round(frac * 100)}%</Badge>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </Stack>
          ))}
        </Drawer>
      </div>
    </CatalogProvider>
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
      <RecipeList recipe={order.proposal.recipe} compact decimal />
      <div className="row">{children}</div>
    </Card>
  );
}

/** Only offered once a ticket exists; before that the printer will get to it anyway. */
function ReprintButton({ order, onReprint }: { order: Order; onReprint: () => void }) {
  if (order.printedAt === undefined) return null;
  return (
    <Button size="sm" variant="ghost" onClick={onReprint} title="Print this ticket again">
      Reprint
    </Button>
  );
}

function PrinterBadge({ printer, now }: { printer: BarView["printer"]; now: number }) {
  // Never heard from a bridge: printing isn't set up, so say nothing.
  if (!printer) return null;
  if (now - printer.at > PRINTER_SILENT_MS) return <Badge tone="danger">Printer bridge offline</Badge>;
  if (!printer.ok) return <Badge tone="danger">Printer error</Badge>;
  if (printer.warning) return <Badge tone="warn">{printer.message}</Badge>;
  return <Badge tone="ok">Printer ready{printer.pending ? ` · ${printer.pending} printing` : ""}</Badge>;
}

function age(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}`;
}
